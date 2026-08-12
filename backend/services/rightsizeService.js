// Right-Sizing Service — recommend a better VM size based on observed
// utilization, with an estimated monthly cost impact.
//
// For every VM we compute the average CPU and memory utilization over the last
// 14 days (from Azure Monitor) and look for a size, among the ones Azure
// reports as available for that VM, that is:
//
//   - smaller & cheaper while keeping projected utilization under a headroom
//     threshold  -> "downsize" recommendation (the main saving lever), or
//   - larger      -> "upsize" when current utilization is dangerously high.
//
// Prices are pay-as-you-go list-rate estimates (USD), so the figures are for
// guidance only. In mock mode (MOCK_DATA=true) utilization comes from the mock
// VM catalog and nothing touches Azure.

const { DefaultAzureCredential } = require('@azure/identity');
const { MonitorManagementClient } = require('@azure/arm-monitor');

const scaleService = require('./scaleService');

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;

const HOURS_PER_MONTH = 730; // Azure bills on a 730-hour month.
const CURRENCY = 'USD';

// Pay-as-you-go hourly rates (USD, East US list prices — estimates).
const HOURLY_PRICE = {
  'Basic_A0': 0.014,
  'Basic_A1': 0.027,
  'Basic_A2': 0.054,
  'Basic_A3': 0.108,
  'Basic_A4': 0.216,
  'Standard_A1_v2': 0.0565,
  'Standard_A2_v2': 0.113,
  'Standard_A4_v2': 0.226,
  'Standard_A8_v2': 0.452,
  'Standard_B1s': 0.0124,
  'Standard_B2s': 0.0496,
  'Standard_B4ms': 0.166,
  'Standard_B8ms': 0.332,
  'Standard_D2s_v3': 0.096,
  'Standard_D4s_v3': 0.192,
  'Standard_D8s_v3': 0.384,
  'Standard_D16s_v3': 0.768,
  'Standard_D32s_v3': 1.536,
  'Standard_D64s_v3': 3.072,
  'Standard_E8s_v3': 0.576,
  'Standard_E16s_v3': 1.152,
  'Standard_E32s_v3': 2.304,
  'Standard_E64s_v3': 4.608,
  'Standard_F2s_v2': 0.084,
  'Standard_F4s_v2': 0.168,
  'Standard_F8s_v2': 0.336,
  'Standard_F16s_v2': 0.672,
  'Standard_F32s_v2': 1.344,
  'Standard_F64s_v2': 2.688,
  'Standard_G1': 0.35,
  'Standard_G2': 0.7,
  'Standard_G4': 1.4,
  'Standard_G8': 2.8,
};

// Fallback for sizes not in the list (e.g. real Azure sizes outside the demo
// catalog): rough estimate from capacity, roughly matching pay-as-you-go.
function hourlyPrice(sizeName) {
  if (HOURLY_PRICE[sizeName] != null) return HOURLY_PRICE[sizeName];
  return Number((sizeName || '').match(/(\d+)/)?.[1]) * 0.048 || 0;
}

function monthlyCost(sizeName) {
  return Number((hourlyPrice(sizeName) * HOURS_PER_MONTH).toFixed(2));
}

function round2(n) {
  return Number(Number(n).toFixed(2));
}

function useMock() {
  return process.env.MOCK_DATA === 'true';
}

let monitorClient;
function getMonitorClient() {
  if (!monitorClient) {
    if (!subscriptionId) throw new Error('AZURE_SUBSCRIPTION_ID is not set');
    monitorClient = new MonitorManagementClient(new DefaultAzureCredential(), subscriptionId);
  }
  return monitorClient;
}

// Pull the arithmetic mean of a metric's averaged time series values.
// @azure/arm-monitor's metrics.list returns `value[]` with `timeseries[].data[]`
// where each point carries the requested aggregation.
function averageMetric(res) {
  const values = [];
  for (const item of res.value || []) {
    for (const series of item.timeseries || []) {
      for (const point of series.data || []) {
        if (typeof point.average === 'number') values.push(point.average);
      }
    }
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Fetch last-14-day average CPU % and memory utilization % for a VM resource.
// Returns null on any failure so a VM we can't observe is simply skipped.
async function getVmUtilization(monitor, resourceId, memoryGB) {
  const timespan = `${new Date(Date.now() - 14 * DAY_MS).toISOString()}/${new Date().toISOString()}`;

  const cpuRes = await monitor.metrics.list(resourceId, {
    metricnames: 'Percentage CPU',
    interval: 'PT1H',
    timespan,
    aggregation: 'Average',
  });
  const avgCpuPct = averageMetric(cpuRes);
  if (avgCpuPct == null) return null;

  let avgMemoryPct = null;
  if (memoryGB > 0) {
    const memRes = await monitor.metrics
      .list(resourceId, {
        metricnames: 'Available Memory Bytes',
        interval: 'PT1H',
        timespan,
        aggregation: 'Average',
      })
      .catch(() => null);
    const availBytes = averageMetric(memRes);
    if (availBytes != null) {
      const totalBytes = memoryGB * 1024 * 1024 * 1024;
      avgMemoryPct = round2(Math.max(0, Math.min(100, (1 - availBytes / totalBytes) * 100)));
    }
  }

  return { avgCpuPct: round2(avgCpuPct), avgMemoryPct };
}

/**
 * Decide the best size for one VM, or return null when it's already a good fit.
 * @param {object} vm VM as returned by scaleService.listVms
 * @param {{ headroomPct?: number, upsizePct?: number, targetAfterPct?: number }} opts
 */
function recommendForVm(vm, opts = {}) {
  const headroomPct = opts.headroomPct ?? 70; // keep projected util <= this after a downsize
  const upsizePct = opts.upsizePct ?? 85; // scale up when utilization exceeds this
  const targetAfterPct = opts.targetAfterPct ?? 75; // upsize target must relieve util to <= this
  const minSavings = opts.minSavings ?? 1; // ignore trivial downsizes

  const current = (vm.availableSizes || []).find((s) => s.name === vm.currentSize);
  if (!current) return null;

  const avgCpuPct = vm.avgCpuPct ?? 0;
  const avgMemoryPct = vm.avgMemoryPct ?? 0;
  const utilNow = Math.max(avgCpuPct, avgMemoryPct);
  const currentMonthly = monthlyCost(vm.currentSize);

  const candidates = (vm.availableSizes || [])
    .filter((s) => s.name !== vm.currentSize)
    .map((s) => {
      const estCpu = (avgCpuPct * current.cores) / s.cores;
      const estMem = (avgMemoryPct * current.memoryGB) / s.memoryGB;
      return {
        size: s,
        estUtil: Math.max(estCpu, estMem),
        monthly: monthlyCost(s.name),
      };
    });

  // Downsize: the cheapest smaller size that still keeps utilization inside
  // headroom after the move.
  const downsizable = candidates
    .filter((c) => c.monthly < currentMonthly && c.estUtil <= headroomPct)
    .sort((a, b) => a.monthly - b.monthly);
  if (downsizable.length > 0) {
    const target = downsizable[0];
    const savings = currentMonthly - target.monthly;
    if (savings >= minSavings) {
      return {
        direction: 'down',
        recommendedSize: target.size.name,
        estimatedUtilAfterPct: Math.round(target.estUtil),
        monthlySavings: round2(savings),
      };
    }
  }

  // Upsize: utilization is dangerously high — suggest the smallest larger size
  // that brings projected utilization back under control.
  if (utilNow > upsizePct) {
    const upsizable = candidates
      .filter((c) => c.monthly > currentMonthly)
      .sort((a, b) => a.monthly - b.monthly);
    const target = upsizable.find((c) => c.estUtil <= targetAfterPct) || upsizable[upsizable.length - 1];
    if (target) {
      return {
        direction: 'up',
        recommendedSize: target.size.name,
        estimatedUtilAfterPct: Math.round(target.estUtil),
        monthlySavings: -round2(target.monthly - currentMonthly), // negative = added cost
      };
    }
  }

  return null;
}

/**
 * Build right-sizing recommendations for every VM.
 * @returns {Promise<object>} { recommendations, count, totalMonthlySavings, totalMonthlyCostRisk, currency }
 */
async function getRecommendations() {
  const vms = await scaleService.listVms();

  if (useMock()) {
    const recommendations = vms
      .map((vm) => {
        const rec = recommendForVm(vm);
        if (!rec) return null;
        return {
          id: vm.id,
          name: vm.name,
          resourceGroup: vm.resourceGroup,
          region: vm.region,
          currentSize: vm.currentSize,
          avgCpuPct: vm.avgCpuPct ?? 0,
          avgMemoryPct: vm.avgMemoryPct ?? 0,
          monthlyCost: monthlyCost(vm.currentSize),
          ...rec,
        };
      })
      .filter(Boolean);
    return summarize(recommendations);
  }

  // Real Azure: attach utilization from Azure Monitor, then recommend.
  const monitor = getMonitorClient();
  const recommendations = [];
  for (const vm of vms) {
    try {
      const current = (vm.availableSizes || []).find((s) => s.name === vm.currentSize);
      const utilization = await getVmUtilization(monitor, vm.id, current?.memoryGB || 0);
      if (!utilization) continue; // no metrics -> skip silently
      const rec = recommendForVm({ ...vm, ...utilization });
      if (!rec) continue;
      recommendations.push({
        id: vm.id,
        name: vm.name,
        resourceGroup: vm.resourceGroup,
        region: vm.region,
        currentSize: vm.currentSize,
        avgCpuPct: utilization.avgCpuPct,
        avgMemoryPct: utilization.avgMemoryPct,
        monthlyCost: monthlyCost(vm.currentSize),
        ...rec,
      });
    } catch (_) {
      // Non-fatal: a VM we can't analyze is left out of the recommendations.
    }
  }
  return summarize(recommendations);
}

function summarize(recommendations) {
  let totalMonthlySavings = 0;
  let totalMonthlyCostRisk = 0;
  for (const r of recommendations) {
    if (r.direction === 'down') totalMonthlySavings += r.monthlySavings;
    else totalMonthlyCostRisk += Math.abs(r.monthlySavings);
  }
  return {
    currency: CURRENCY,
    count: recommendations.length,
    totalMonthlySavings: round2(totalMonthlySavings),
    totalMonthlyCostRisk: round2(totalMonthlyCostRisk),
    recommendations: recommendations.sort((a, b) => b.monthlySavings - a.monthlySavings),
  };
}

module.exports = { getRecommendations, recommendForVm, monthlyCost, hourlyPrice };
