// Scale Service — resize Azure Virtual Machines up or down to match actual
// usage. Complements the Idle Resource Hunter's "Downsize" suggestions.
//
// GET lists every VM with its current size and the sizes available for
// resizing (from Azure's own available-sizes API), so the UI can offer only
// valid targets. POST performs the resize.
//
// Resize behavior:
//   - Attempts the resize in place (no downtime). If Azure rejects it while
//     the VM is running (size not available on the current host), it falls
//     back to deallocate -> resize -> start, which briefly restarts the VM.
//   - Each VM is best-effort and reported individually, so one failure never
//     aborts the batch.
//
// DANGER: resizing can restart a VM (brief downtime). The route layer requires
// an explicit `confirm: true`, and the frontend shows a confirmation dialog.
// The service principal needs write access, e.g. Microsoft.Compute/virtualMachines/write
// (Contributor covers this) at the subscription or resource group scope.
//
// In mock mode (MOCK_DATA=true) nothing is touched on Azure — the VM's size is
// simply updated in an in-memory table so the UI reflects the change.

const { DefaultAzureCredential } = require('@azure/identity');
const { ComputeManagementClient } = require('@azure/arm-compute');

const mockVms = require('../mocks/vms');
const { createAuditLogger } = require('./auditLogger');

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const scanResourceGroup = process.env.AZURE_RESOURCE_GROUP || null;

// Durable audit trail (memory + file + optional webhook).
const audit = createAuditLogger('scale');

let computeClient;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function useMock() {
  return process.env.MOCK_DATA === 'true';
}

function getComputeClient() {
  if (!computeClient) {
    if (!subscriptionId) throw new Error('AZURE_SUBSCRIPTION_ID is not set');
    computeClient = new ComputeManagementClient(new DefaultAzureCredential(), subscriptionId);
  }
  return computeClient;
}

// Pull resource group + resource name out of an ARM resource ID.
function parseArmId(id) {
  const m =
    /\/subscriptions\/[^/]+\/resourceGroups\/([^/]+)\/providers\/[^/]+\/[^/]+\/([^/]+)$/.exec(
      id || ''
    );
  return m ? { resourceGroup: m[1], name: m[2] } : null;
}

function isRealArmId(id) {
  return typeof id === 'string' && id.startsWith('/subscriptions/');
}

// The ARM ID's subscription must match the one this server is configured for.
// The resource group (when AZURE_RESOURCE_GROUP is set) must match too, so
// destructive/resizing actions stay scoped to the intended blast radius.
function withinAllowedScope(id, parsed) {
  if (subscriptionId && !id.startsWith(`/subscriptions/${subscriptionId}/`)) {
    return `Resource is outside the configured subscription (${subscriptionId}).`;
  }
  if (scanResourceGroup && parsed.resourceGroup !== scanResourceGroup) {
    return `Resource is outside the configured resource group (${scanResourceGroup}).`;
  }
  return null;
}

function compareSizes(a, b) {
  return (a.cores || 0) - (b.cores || 0) || (a.memoryGB || 0) - (b.memoryGB || 0);
}

// Resize a single VM. Tries in-place first; on failure deallocates, resizes,
// and (only if it was running) starts it again.
async function resizeRealVm(compute, resourceGroup, name, targetSize) {
  let available;
  try {
    available = await compute.virtualMachines.listAvailableSizes(resourceGroup, name);
  } catch (err) {
    throw new Error(`Could not list available sizes: ${err.message}`);
  }
  const names = available.map((s) => s.name);
  if (!names.includes(targetSize)) {
    throw new Error(`Size ${targetSize} is not available for this VM (${names.join(', ')}).`);
  }

  try {
    await compute.virtualMachines.beginUpdateAndWait(resourceGroup, name, {
      hardwareProfile: { vmSize: targetSize },
    });
    return { name, size: targetSize, method: 'resized' };
  } catch (err) {
    // Fallback path needs to know the power state before touching the VM.
    const view = await compute.virtualMachines.instanceView(resourceGroup, name).catch(() => null);
    const status = (view?.statuses || []).find((s) => s.code?.startsWith('PowerState/'));
    const power = status?.code?.replace('PowerState/', '');
    if (!power) throw err;

    await compute.virtualMachines.beginDeallocateAndWait(resourceGroup, name);
    await compute.virtualMachines.beginUpdateAndWait(resourceGroup, name, {
      hardwareProfile: { vmSize: targetSize },
    });
    if (power === 'running') {
      await compute.virtualMachines.beginStartAndWait(resourceGroup, name);
      return { name, size: targetSize, method: 'resized-with-restart' };
    }
    return { name, size: targetSize, method: 'resized-while-deallocated' };
  }
}

/**
 * List VMs with their current size and the sizes available for resizing.
 * @returns {Promise<Array<object>>}
 */
async function listVms() {
  if (useMock()) return mockVms.getMockVms();

  const compute = getComputeClient();
  const vms = [];
  for await (const vm of compute.virtualMachines.listAll()) {
    const parsed = parseArmId(vm.id);
    if (!parsed || !vm.name) continue;
    let sizes = [];
    try {
      const raw = await compute.virtualMachines.listAvailableSizes(parsed.resourceGroup, vm.name);
      sizes = raw
        .map((s) => ({
          name: s.name,
          cores: s.numberOfCores,
          memoryGB: Math.round((s.memoryInMB || 0) / 1024),
        }))
        .sort(compareSizes);
    } catch (_) {
      // Non-fatal: a VM we can't inspect is still listed without size options.
    }
    vms.push({
      id: vm.id,
      name: vm.name,
      resourceGroup: parsed.resourceGroup,
      region: vm.location,
      currentSize: vm.hardwareProfile?.vmSize,
      availableSizes: sizes,
    });
  }
  return vms;
}

async function resizeMockVms(resources) {
  const vms = mockVms.getMockVms();
  const byId = new Map(vms.map((v) => [v.id, v]));
  const succeeded = [];
  const failed = [];

  for (const r of resources) {
    const vm = byId.get(r.id);
    if (!vm) {
      failed.push({ id: r.id, targetSize: r.targetSize, error: 'VM not found.' });
      continue;
    }
    if (!vm.availableSizes.some((s) => s.name === r.targetSize)) {
      failed.push({ id: r.id, name: vm.name, targetSize: r.targetSize, error: `Size ${r.targetSize} is not available for this VM.` });
      continue;
    }
    const detail = mockVms.mockResize(r.id, r.targetSize);
    succeeded.push({
      id: r.id,
      name: vm.name,
      resourceGroup: vm.resourceGroup,
      currentSize: vm.currentSize,
      targetSize: r.targetSize,
      details: detail,
    });
  }

  return { succeeded, failed };
}

async function resizeRealVms(resources) {
  const compute = getComputeClient();
  const succeeded = [];
  const failed = [];

  for (const r of resources) {
    if (!isRealArmId(r.id)) {
      failed.push({ id: r.id, targetSize: r.targetSize, error: 'Invalid Azure resource ID.' });
      continue;
    }
    const parsed = parseArmId(r.id);
    if (!parsed) {
      failed.push({ id: r.id, targetSize: r.targetSize, error: 'Could not parse the resource ID.' });
      continue;
    }
    const scopeError = withinAllowedScope(r.id, parsed);
    if (scopeError) {
      failed.push({ id: r.id, name: parsed.name, targetSize: r.targetSize, error: scopeError });
      continue;
    }
    try {
      const detail = await resizeRealVm(compute, parsed.resourceGroup, parsed.name, r.targetSize);
      succeeded.push({
        id: r.id,
        name: parsed.name,
        resourceGroup: parsed.resourceGroup,
        currentSize: r.currentSize || null,
        targetSize: r.targetSize,
        details: detail,
      });
    } catch (err) {
      failed.push({ id: r.id, name: parsed.name, targetSize: r.targetSize, error: err.message });
    }
  }

  return { succeeded, failed };
}

/**
 * Validate and run a resize request.
 * @param {{ resources: Array<{id:string,targetSize:string,currentSize?:string}>, confirm: boolean }} body
 * @returns {Promise<object>} per-resource succeeded/failed results
 */
async function resizeVms(body = {}) {
  const { resources, confirm } = body;

  if (confirm !== true) {
    throw new HttpError(400, 'Confirmation is required — pass confirm: true to resize VMs.');
  }
  if (!Array.isArray(resources) || resources.length === 0) {
    throw new HttpError(400, 'resources must be a non-empty array.');
  }
  for (const r of resources) {
    if (!r || typeof r.id !== 'string' || !r.id) {
      throw new HttpError(400, 'Each resource needs an id.');
    }
    if (typeof r.targetSize !== 'string' || !r.targetSize) {
      throw new HttpError(400, 'Each resource needs a targetSize.');
    }
  }

  const { succeeded, failed } = useMock()
    ? await resizeMockVms(resources)
    : await resizeRealVms(resources);

  audit.append({
    timestamp: new Date().toISOString(),
    requested: resources.length,
    succeededCount: succeeded.length,
    failedCount: failed.length,
    mockMode: useMock(),
    resources: resources.map((r) => {
      const ok = succeeded.find((s) => s.id === r.id);
      const bad = failed.find((f) => f.id === r.id);
      return {
        id: r.id,
        name: (ok && ok.name) || (bad && bad.name) || null,
        targetSize: r.targetSize,
        status: ok ? 'resized' : 'failed',
        error: bad && bad.error,
      };
    }),
  });

  return {
    requested: resources.length,
    succeeded,
    failed,
  };
}

function getAudit() {
  return audit.list();
}

function resetMock() {
  mockVms.resetMock();
}

module.exports = {
  listVms,
  resizeVms,
  getAudit,
  resetMock,
  HttpError,
};
