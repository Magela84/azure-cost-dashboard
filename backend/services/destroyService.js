// Destroy Service — permanently deletes idle/orphaned resources identified by
// the Idle Resource Hunter so their recurring cost stops. Each delete is
// best-effort and reported individually, so one failure never aborts the batch.
//
// DANGER: deletion is irreversible. The route layer enforces an explicit
// `confirm: true` before anything is touched and the frontend shows a
// confirmation dialog before calling it.
//
// What each type does:
//   - Idle VM / Deallocated VM  → deletes the VM AND its managed OS/data disks
//   - Unattached Disk           → deletes the managed disk
//   - Stale Snapshot            → deletes the snapshot
//   - Unassociated Public IP    → deletes the public IP address
//
// The service principal behind DefaultAzureCredential must hold delete rights
// (e.g. Contributor, or a custom role allowing Microsoft.Compute/*/delete and
// Microsoft.Network/publicIPAddresses/delete) at the subscription or resource
// group scope.
//
// In mock mode (MOCK_DATA=true) nothing is actually deleted — findings are
// simply marked as "destroyed" so the hunter stops reporting them.

const { DefaultAzureCredential } = require('@azure/identity');
const { ComputeManagementClient } = require('@azure/arm-compute');
const { NetworkManagementClient } = require('@azure/arm-network');

const idleResourceService = require('./idleResourceService');
const { createAuditLogger } = require('./auditLogger');

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const scanResourceGroup = process.env.AZURE_RESOURCE_GROUP || null;

const KNOWN_TYPES = new Set([
  'Idle VM',
  'Deallocated VM',
  'Unattached Disk',
  'Stale Snapshot',
  'Unassociated Public IP',
]);

// Durable audit trail (memory + file + optional webhook).
const audit = createAuditLogger('destroy');

let computeClient;
let networkClient;

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

function getNetworkClient() {
  if (!networkClient) {
    if (!subscriptionId) throw new Error('AZURE_SUBSCRIPTION_ID is not set');
    networkClient = new NetworkManagementClient(new DefaultAzureCredential(), subscriptionId);
  }
  return networkClient;
}

const round2 = (n) => Number(Number(n).toFixed(2));

// Pull resource group + resource name out of an ARM resource ID:
// /subscriptions/<sub>/resourceGroups/<rg>/providers/<ns>/<type>/<name>
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
// deletions stay scoped to the intended blast radius.
function withinAllowedScope(id, parsed) {
  if (subscriptionId && !id.startsWith(`/subscriptions/${subscriptionId}/`)) {
    return `Resource is outside the configured subscription (${subscriptionId}).`;
  }
  if (scanResourceGroup && parsed.resourceGroup !== scanResourceGroup) {
    return `Resource is outside the configured resource group (${scanResourceGroup}).`;
  }
  return null;
}

// Delete a VM, then its managed OS/data disks so no storage cost lingers.
// Disk deletion is best-effort: a disk that fails stays unattached and is
// simply re-flagged by the hunter on the next scan.
async function destroyVm(compute, resourceGroup, name) {
  const vm = await compute.virtualMachines.get(resourceGroup, name);
  const diskNames = [];
  if (vm.storageProfile?.osDisk?.name) diskNames.push(vm.storageProfile.osDisk.name);
  for (const d of vm.storageProfile?.dataDisks || []) {
    if (d.name && !diskNames.includes(d.name)) diskNames.push(d.name);
  }

  await compute.virtualMachines.beginDeleteAndWait(resourceGroup, name);

  let failedDisks = 0;
  for (const diskName of diskNames) {
    try {
      await compute.disks.beginDeleteAndWait(resourceGroup, diskName);
    } catch (_) {
      failedDisks += 1;
    }
  }

  return { name, disks: diskNames, failedDisks };
}

async function destroyResource(compute, network, type, { resourceGroup, name }) {
  switch (type) {
    case 'Idle VM':
    case 'Deallocated VM':
      return destroyVm(compute, resourceGroup, name);
    case 'Unattached Disk':
      await compute.disks.beginDeleteAndWait(resourceGroup, name);
      return { name };
    case 'Stale Snapshot':
      await compute.snapshots.beginDeleteAndWait(resourceGroup, name);
      return { name };
    case 'Unassociated Public IP':
      await network.publicIPAddresses.beginDeleteAndWait(resourceGroup, name);
      return { name };
    default:
      throw new Error(`Unsupported resource type: ${type}`);
  }
}

async function destroyRealResources(resources) {
  const compute = getComputeClient();
  const network = getNetworkClient();
  const succeeded = [];
  const failed = [];

  for (const r of resources) {
    if (!isRealArmId(r.id)) {
      failed.push({ id: r.id, type: r.type, name: r.name || null, error: 'Invalid Azure resource ID.' });
      continue;
    }
    const parsed = parseArmId(r.id);
    if (!parsed) {
      failed.push({ id: r.id, type: r.type, name: r.name || null, error: 'Could not parse the resource ID.' });
      continue;
    }
    const scopeError = withinAllowedScope(r.id, parsed);
    if (scopeError) {
      failed.push({ id: r.id, type: r.type, name: parsed.name, error: scopeError });
      continue;
    }
    try {
      const detail = await destroyResource(compute, network, r.type, parsed);
      succeeded.push({
        id: r.id,
        type: r.type,
        name: parsed.name,
        resourceGroup: parsed.resourceGroup,
        details: detail,
      });
    } catch (err) {
      failed.push({ id: r.id, type: r.type, name: parsed.name, error: err.message });
    }
  }

  return { succeeded, failed };
}

async function destroyMockResources(resources) {
  const { findings } = await idleResourceService.getIdleResources();
  const byId = new Map(findings.map((f) => [f.id, f]));
  const succeeded = [];
  const failed = [];

  for (const r of resources) {
    if (idleResourceService.isMockDestroyed(r.id)) {
      failed.push({ id: r.id, type: r.type, name: r.name || null, error: 'Resource was already destroyed.' });
      continue;
    }
    const finding = byId.get(r.id);
    if (!finding) {
      failed.push({ id: r.id, type: r.type, name: r.name || null, error: 'Resource not found in the current scan.' });
      continue;
    }
    idleResourceService.markMockDestroyed(r.id);
    succeeded.push({
      id: r.id,
      type: finding.type,
      name: finding.name,
      resourceGroup: finding.resourceGroup,
      monthlyCost: finding.monthlyCost,
      details: { simulated: true },
    });
  }

  return { succeeded, failed };
}

/**
 * Validate and run a destroy request.
 * @param {{ resources: Array<{id:string,type:string,name?:string,monthlyCost?:number}>, confirm: boolean }} body
 * @returns {Promise<object>} per-resource succeeded/failed results + savings
 */
async function destroyResources(body = {}) {
  const { resources, confirm } = body;

  if (confirm !== true) {
    throw new HttpError(400, 'Confirmation is required — pass confirm: true to destroy resources.');
  }
  if (!Array.isArray(resources) || resources.length === 0) {
    throw new HttpError(400, 'resources must be a non-empty array.');
  }
  for (const r of resources) {
    if (!r || typeof r.id !== 'string' || !r.id) {
      throw new HttpError(400, 'Each resource needs an id.');
    }
    if (!KNOWN_TYPES.has(r.type)) {
      throw new HttpError(400, `Unsupported resource type: ${r.type}`);
    }
  }

  const { succeeded, failed } = useMock()
    ? await destroyMockResources(resources)
    : await destroyRealResources(resources);

  const totalPotentialMonthlySavings = round2(
    succeeded.reduce((sum, s) => sum + (s.monthlyCost || 0), 0)
  );

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
        type: r.type,
        name: (ok && ok.name) || (bad && bad.name) || r.name || null,
        status: ok ? 'destroyed' : 'failed',
        error: bad && bad.error,
      };
    }),
  });

  return {
    currency: 'USD',
    totalPotentialMonthlySavings,
    requested: resources.length,
    succeeded,
    failed,
  };
}

function getAudit() {
  return audit.list();
}

module.exports = {
  destroyResources,
  getAudit,
  HttpError,
  KNOWN_TYPES,
};
