// Mock VM data for the VM Scaling feature (demo / MOCK_DATA=true mode).
// Each VM lists the sizes Azure would report as available for resizing.
// Simulated resizes persist for the life of the process via `currentSizes`.

const SIZES = [
  { name: 'Standard_B2s', cores: 2, memoryGB: 4 },
  { name: 'Standard_B4ms', cores: 4, memoryGB: 16 },
  { name: 'Standard_D2s_v3', cores: 2, memoryGB: 8 },
  { name: 'Standard_D4s_v3', cores: 4, memoryGB: 16 },
  { name: 'Standard_D8s_v3', cores: 8, memoryGB: 32 },
  { name: 'Standard_E8s_v3', cores: 8, memoryGB: 64 },
  { name: 'Standard_E16s_v3', cores: 16, memoryGB: 128 },
];

const BASE_VMS = [
  {
    id: '/subscriptions/mock/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-web01',
    name: 'vm-web01',
    resourceGroup: 'demo-rg',
    region: 'eastus',
    currentSize: 'Standard_D2s_v3',
    availableSizeNames: ['Standard_B2s', 'Standard_D2s_v3', 'Standard_D4s_v3', 'Standard_D8s_v3'],
  },
  {
    id: '/subscriptions/mock/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-staging-01',
    name: 'vm-staging-01',
    resourceGroup: 'demo-rg',
    region: 'eastus',
    currentSize: 'Standard_D4s_v3',
    availableSizeNames: ['Standard_D2s_v3', 'Standard_D4s_v3', 'Standard_D8s_v3', 'Standard_E8s_v3'],
  },
  {
    id: '/subscriptions/mock/resourceGroups/analytics-rg/providers/Microsoft.Compute/virtualMachines/vm-analytics-old',
    name: 'vm-analytics-old',
    resourceGroup: 'analytics-rg',
    region: 'westeurope',
    currentSize: 'Standard_E8s_v3',
    availableSizeNames: ['Standard_D4s_v3', 'Standard_D8s_v3', 'Standard_E8s_v3', 'Standard_E16s_v3'],
  },
  {
    id: '/subscriptions/mock/resourceGroups/demo-rg/providers/Microsoft.Compute/virtualMachines/vm-batch-legacy',
    name: 'vm-batch-legacy',
    resourceGroup: 'demo-rg',
    region: 'eastus',
    currentSize: 'Standard_D2s_v3',
    availableSizeNames: ['Standard_B2s', 'Standard_B4ms', 'Standard_D2s_v3', 'Standard_D4s_v3'],
  },
  {
    id: '/subscriptions/mock/resourceGroups/db-rg/providers/Microsoft.Compute/virtualMachines/vm-db-primary',
    name: 'vm-db-primary',
    resourceGroup: 'db-rg',
    region: 'eastus',
    currentSize: 'Standard_E16s_v3',
    availableSizeNames: ['Standard_E8s_v3', 'Standard_E16s_v3'],
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
