// Mock VM data for the VM Scaling feature (demo / MOCK_DATA=true mode).
// Each VM lists the sizes Azure would report as available for resizing.
// Simulated resizes persist for the life of the process via `currentSizes`.

// A realistic subset of Azure VM sizes across families (A, B, D, E, F, G).
// In mock mode each VM only offers the sizes a host would realistically report
// as available for resizing — not the whole catalog.
const SIZES = [
  // A-series (basic / general purpose)
  { name: 'Basic_A0', cores: 1, memoryGB: 1 },
  { name: 'Basic_A1', cores: 1, memoryGB: 2 },
  { name: 'Basic_A2', cores: 2, memoryGB: 4 },
  { name: 'Basic_A3', cores: 4, memoryGB: 7 },
  { name: 'Basic_A4', cores: 8, memoryGB: 14 },
  { name: 'Standard_A1_v2', cores: 1, memoryGB: 2 },
  { name: 'Standard_A2_v2', cores: 2, memoryGB: 4 },
  { name: 'Standard_A4_v2', cores: 4, memoryGB: 8 },
  { name: 'Standard_A8_v2', cores: 8, memoryGB: 16 },

  // B-series (burstable)
  { name: 'Standard_B1s', cores: 1, memoryGB: 1 },
  { name: 'Standard_B2s', cores: 2, memoryGB: 4 },
  { name: 'Standard_B4ms', cores: 4, memoryGB: 16 },
  { name: 'Standard_B8ms', cores: 8, memoryGB: 32 },

  // D-series v3 (general purpose)
  { name: 'Standard_D2s_v3', cores: 2, memoryGB: 8 },
  { name: 'Standard_D4s_v3', cores: 4, memoryGB: 16 },
  { name: 'Standard_D8s_v3', cores: 8, memoryGB: 32 },
  { name: 'Standard_D16s_v3', cores: 16, memoryGB: 64 },
  { name: 'Standard_D32s_v3', cores: 32, memoryGB: 128 },
  { name: 'Standard_D64s_v3', cores: 64, memoryGB: 256 },

  // E-series v3 (memory optimized)
  { name: 'Standard_E8s_v3', cores: 8, memoryGB: 64 },
  { name: 'Standard_E16s_v3', cores: 16, memoryGB: 128 },
  { name: 'Standard_E32s_v3', cores: 32, memoryGB: 256 },
  { name: 'Standard_E64s_v3', cores: 64, memoryGB: 432 },

  // F-series v2 (compute optimized)
  { name: 'Standard_F2s_v2', cores: 2, memoryGB: 4 },
  { name: 'Standard_F4s_v2', cores: 4, memoryGB: 8 },
  { name: 'Standard_F8s_v2', cores: 8, memoryGB: 16 },
  { name: 'Standard_F16s_v2', cores: 16, memoryGB: 32 },
  { name: 'Standard_F32s_v2', cores: 32, memoryGB: 64 },
  { name: 'Standard_F64s_v2', cores: 64, memoryGB: 128 },

  // G-series (memory heavy, large)
  { name: 'Standard_G1', cores: 2, memoryGB: 14 },
  { name: 'Standard_G2', cores: 4, memoryGB: 28 },
  { name: 'Standard_G4', cores: 8, memoryGB: 56 },
  { name: 'Standard_G8', cores: 16, memoryGB: 112 },
];

const BASE_VMS = [
  {
    id: '/subscriptions/mock/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-web01',
    name: 'vm-web01',
    resourceGroup: 'demo-rg',
    region: 'eastus',
    currentSize: 'Standard_D2s_v3',
    availableSizeNames: [
      'Standard_B1s',
      'Standard_B2s',
      'Standard_A2_v2',
      'Standard_D2s_v3',
      'Standard_D4s_v3',
      'Standard_D8s_v3',
    ],
  },
  {
    id: '/subscriptions/mock/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-staging-01',
    name: 'vm-staging-01',
    resourceGroup: 'demo-rg',
    region: 'eastus',
    currentSize: 'Standard_D4s_v3',
    availableSizeNames: [
      'Standard_D2s_v3',
      'Standard_D4s_v3',
      'Standard_D8s_v3',
      'Standard_D16s_v3',
      'Standard_E8s_v3',
    ],
  },
  {
    id: '/subscriptions/mock/resourceGroups/dev-rg/providers/Microsoft.Compute/virtualMachines/vm-dev-01',
    name: 'vm-dev-01',
    resourceGroup: 'dev-rg',
    region: 'eastus',
    currentSize: 'Standard_B2s',
    availableSizeNames: [
      'Basic_A0',
      'Basic_A1',
      'Standard_B1s',
      'Standard_B2s',
      'Standard_B4ms',
      'Standard_D2s_v3',
    ],
  },
  {
    id: '/subscriptions/mock/resourceGroups/prod-rg/providers/Microsoft.Compute/virtualMachines/vm-prod-01',
    name: 'vm-prod-01',
    resourceGroup: 'prod-rg',
    region: 'eastus',
    currentSize: 'Standard_D8s_v3',
    availableSizeNames: [
      'Standard_D4s_v3',
      'Standard_D8s_v3',
      'Standard_D16s_v3',
      'Standard_E8s_v3',
      'Standard_E16s_v3',
    ],
  },
  {
    id: '/subscriptions/mock/resourceGroups/analytics-rg/providers/Microsoft.Compute/virtualMachines/vm-analytics-old',
    name: 'vm-analytics-old',
    resourceGroup: 'analytics-rg',
    region: 'westeurope',
    currentSize: 'Standard_E8s_v3',
    availableSizeNames: [
      'Standard_D8s_v3',
      'Standard_D16s_v3',
      'Standard_E8s_v3',
      'Standard_E16s_v3',
      'Standard_E32s_v3',
    ],
  },
  {
    id: '/subscriptions/mock/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-batch-legacy',
    name: 'vm-batch-legacy',
    resourceGroup: 'demo-rg',
    region: 'eastus',
    currentSize: 'Standard_F4s_v2',
    availableSizeNames: [
      'Standard_F2s_v2',
      'Standard_F4s_v2',
      'Standard_F8s_v2',
      'Standard_F16s_v2',
    ],
  },
  {
    id: '/subscriptions/mock/resourceGroups/db-rg/providers/Microsoft.Compute/virtualMachines/vm-db-primary',
    name: 'vm-db-primary',
    resourceGroup: 'db-rg',
    region: 'eastus',
    currentSize: 'Standard_E16s_v3',
    availableSizeNames: [
      'Standard_E8s_v3',
      'Standard_E16s_v3',
      'Standard_E32s_v3',
      'Standard_E64s_v3',
      'Standard_G8',
    ],
  },
];

// Simulated resizes, keyed by VM id (module scope so they persist in-process).
const currentSizes = new Map();

function sizeOf(name) {
  return SIZES.find((s) => s.name === name);
}

function getMockVms() {
  return BASE_VMS.map((vm) => {
    const sizeNames = [...vm.availableSizeNames];
    const current = currentSizes.get(vm.id) || vm.currentSize;
    // Keep the current size in the available list.
    if (!sizeNames.includes(current)) sizeNames.push(current);
    return {
      id: vm.id,
      name: vm.name,
      resourceGroup: vm.resourceGroup,
      region: vm.region,
      currentSize: current,
      availableSizes: sizeNames
        .map(sizeOf)
        .filter(Boolean)
        .sort((a, b) => a.cores - b.cores || a.memoryGB - b.memoryGB),
    };
  });
}

function mockResize(id, targetSize) {
  const vm = getMockVms().find((v) => v.id === id);
  if (!vm) throw new Error('VM not found.');
  if (!vm.availableSizes.some((s) => s.name === targetSize)) {
    throw new Error(`Size ${targetSize} is not available for this VM.`);
  }
  currentSizes.set(id, targetSize);
  return { name: vm.name, size: targetSize, method: 'simulated' };
}

function resetMock() {
  currentSizes.clear();
}

module.exports = { getMockVms, mockResize, resetMock };
