// Idle Resource Hunter — finds resources that cost money but do nothing:
// unattached managed disks, unassociated public IPs, stale snapshots, and
// deallocated VMs whose disks are still billed. Each finding carries an
// estimated monthly cost so the UI can headline total waste.
//
// Cost figures are rough US-region list-price estimates (see PRICING below) —
// good enough to rank waste, not a billing source of truth. A future version
// could pull exact rates from the Azure Retail Prices API.

const { DefaultAzureCredential } = require('@azure/identity');
const { ComputeManagementClient } = require('@azure/arm-compute');
const { NetworkManagementClient } = require('@azure/arm-network');

const mockIdle = require('../mocks/idleResources');

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

let computeClient;
let networkClient;

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

// Rough US-region list prices (USD/month).
const PRICING = {
  disk: { Premium_LRS: 0.14, StandardSSD_LRS: 0.075, Standard_LRS: 0.05, UltraSSD_LRS: 0.15 },
  diskDefault: 0.1, // $/GB-month when the SKU isn't recognized
  snapshotPerGb: 0.05, // $/GB-month
  publicIp: 3.65, // standard static IP, $/month
};

const round2 = (n) => Number(Number(n).toFixed(2));

// Pull the resource group name out of an ARM resource ID.
function rgFromId(id) {
  const m = /resourceGroups\/([^/]+)/i.exec(id || '');
  return m ? m[1] : undefined;
}

function estimateDiskCost(sku, sizeGb) {
  const rate = PRICING.disk[sku] ?? PRICING.diskDefault;
  return round2(rate * (sizeGb || 0));
}

function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

async function findUnattachedDisks(compute) {
  const findings = [];
  for await (const d of compute.disks.list()) {
    if (d.diskState === 'Unattached') {
      const sku = d.sku?.name;
      findings.push({
        id: d.id,
        type: 'Unattached Disk',
        name: d.name,
        resourceGroup: rgFromId(d.id),
        region: d.location,
        reason: `Managed disk not attached to any VM (${sku || 'unknown SKU'}, ${d.diskSizeGB} GB).`,
        monthlyCost: estimateDiskCost(sku, d.diskSizeGB),
        currency: 'USD',
        actionHint: 'Delete if no longer needed, or snapshot then delete.',
        details: { sku, sizeGB: d.diskSizeGB, diskState: d.diskState },
      });
    }
  }
  return findings;
}

async function findStaleSnapshots(compute, maxAgeDays = 90) {
  const findings = [];
  for await (const s of compute.snapshots.list()) {
    const ageDays = daysSince(s.timeCreated);
    if (ageDays != null && ageDays > maxAgeDays) {
      findings.push({
        id: s.id,
        type: 'Stale Snapshot',
        name: s.name,
        resourceGroup: rgFromId(s.id),
        region: s.location,
        reason: `Snapshot is ${ageDays} days old (${s.diskSizeGB} GB).`,
        monthlyCost: round2(PRICING.snapshotPerGb * (s.diskSizeGB || 0)),
        currency: 'USD',
        actionHint: 'Delete if the restore point is no longer required.',
        details: { sizeGB: s.diskSizeGB, ageDays },
      });
    }
  }
  return findings;
}

async function findUnassociatedPublicIps(network) {
  const findings = [];
  for await (const ip of network.publicIPAddresses.listAll()) {
    // No ipConfiguration and not attached to a NAT gateway → nothing is using it.
    if (!ip.ipConfiguration && !ip.natGateway) {
      findings.push({
        id: ip.id,
        type: 'Unassociated Public IP',
        name: ip.name,
        resourceGroup: rgFromId(ip.id),
        region: ip.location,
        reason: 'Public IP not associated with any resource.',
        monthlyCost: PRICING.publicIp,
        currency: 'USD',
        actionHint: 'Delete the public IP address.',
        details: {
          sku: ip.sku?.name,
          allocationMethod: ip.publicIPAllocationMethod,
        },
      });
    }
  }
  return findings;
}

// Deallocated VMs cost no compute, but their managed disks are still billed.
// Requires a per-VM instanceView call, so failures are swallowed per VM.
async function findDeallocatedVms(compute) {
  const findings = [];
  for await (const vm of compute.virtualMachines.listAll()) {
    const rg = rgFromId(vm.id);
    if (!rg || !vm.name) continue;
    try {
      const view = await compute.virtualMachines.instanceView(rg, vm.name);
      const power = (view.statuses || []).find((s) => s.code?.startsWith('PowerState/'));
      const state = power?.code?.replace('PowerState/', '');
      if (state === 'deallocated') {
        findings.push({
          id: vm.id,
          type: 'Deallocated VM',
          name: vm.name,
          resourceGroup: rg,
          region: vm.location,
          reason: 'VM is deallocated, but its managed disks are still billed.',
          // Disk cost is reported separately if the disk is unattached; here we
          // just flag the VM. Estimate left null when unknown.
          monthlyCost: 0,
          currency: 'USD',
          actionHint: 'Delete the VM and its disks if it will not be restarted.',
          details: { size: vm.hardwareProfile?.vmSize, powerState: 'deallocated' },
        });
      }
    } catch (_) {
      /* skip VMs we can't inspect */
    }
  }
  return findings;
}

function summarize(findings) {
  const totalMonthlyWaste = round2(findings.reduce((sum, f) => sum + (f.monthlyCost || 0), 0));
  const byType = {};
  for (const f of findings) {
    byType[f.type] = byType[f.type] || { count: 0, monthlyCost: 0 };
    byType[f.type].count += 1;
    byType[f.type].monthlyCost = round2(byType[f.type].monthlyCost + (f.monthlyCost || 0));
  }
  return {
    currency: 'USD',
    totalMonthlyWaste,
    findingCount: findings.length,
    byType,
    findings: findings.sort((a, b) => (b.monthlyCost || 0) - (a.monthlyCost || 0)),
  };
}

/**
 * Scan the subscription for idle/orphaned resources.
 * @returns {Promise<object>} summary + findings
 */
async function getIdleResources() {
  if (useMock()) return summarize(mockIdle.getMockIdleResources());

  const compute = getComputeClient();
  const network = getNetworkClient();

  // Run the independent scans in parallel; each is best-effort.
  const [disks, snapshots, publicIps, deallocatedVms] = await Promise.all([
    findUnattachedDisks(compute).catch(() => []),
    findStaleSnapshots(compute).catch(() => []),
    findUnassociatedPublicIps(network).catch(() => []),
    findDeallocatedVms(compute).catch(() => []),
  ]);

  // NOTE: running-but-idle VM detection (low CPU via @azure/arm-monitor metrics)
  // is showcased in mock mode; wiring it against live metrics is a future step.
  return summarize([...disks, ...snapshots, ...publicIps, ...deallocatedVms]);
}

module.exports = {
  getIdleResources,
  subscriptionId,
};
