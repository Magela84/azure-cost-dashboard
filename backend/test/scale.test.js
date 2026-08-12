// Unit tests for the VM Scaling feature, exercised through the mock data path
// (no Azure credentials needed). Simulated resizes update an in-memory table.

const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.MOCK_DATA = 'true';
const scale = require('../services/scaleService');

test.beforeEach(() => {
  scale.resetMock();
});

test('listVms returns VMs with current size and sorted available sizes', async () => {
  const vms = await scale.listVms();

  assert.ok(vms.length > 0);
  for (const vm of vms) {
    assert.ok(vm.id.startsWith('/subscriptions/'));
    assert.ok(vm.currentSize, `VM ${vm.name} missing currentSize`);
    assert.ok(vm.availableSizes.length > 0, `VM ${vm.name} has no available sizes`);
    for (let i = 1; i < vm.availableSizes.length; i++) {
      const prev = vm.availableSizes[i - 1];
      const cur = vm.availableSizes[i];
      const prevPower = prev.cores * 4 + prev.memoryGB;
      const curPower = cur.cores * 4 + cur.memoryGB;
      assert.ok(prevPower <= curPower, `sizes not sorted for ${vm.name}`);
    }
  }
});

test('resizing a VM succeeds and updates its current size', async () => {
  const vms = await scale.listVms();
  const vm = vms.find((v) => v.availableSizes.length > 1);
  const target = vm.availableSizes.find((s) => s.name !== vm.currentSize).name;

  const result = await scale.resizeVms({
    confirm: true,
    resources: [{ id: vm.id, targetSize: target }],
  });

  assert.equal(result.failed.length, 0);
  assert.equal(result.succeeded.length, 1);
  assert.equal(result.succeeded[0].targetSize, target);

  const after = await scale.listVms();
  const updated = after.find((v) => v.id === vm.id);
  assert.equal(updated.currentSize, target);
});

test('resizing to an unavailable size fails without changing the VM', async () => {
  const vms = await scale.listVms();
  const vm = vms[0];

  const result = await scale.resizeVms({
    confirm: true,
    resources: [{ id: vm.id, targetSize: 'Standard_HC44rs' }],
  });

  assert.equal(result.succeeded.length, 0);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].error, /not available/i);

  const after = await scale.listVms();
  assert.equal(after.find((v) => v.id === vm.id).currentSize, vm.currentSize);
});

test('resizing an unknown VM reports a failure', async () => {
  const result = await scale.resizeVms({
    confirm: true,
    resources: [{ id: '/subscriptions/x/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/nope', targetSize: 'Standard_D2s_v3' }],
  });
  assert.equal(result.succeeded.length, 0);
  assert.equal(result.failed.length, 1);
});

test('missing confirm is rejected', async () => {
  await assert.rejects(
    scale.resizeVms({ resources: [{ id: 'x', targetSize: 'Standard_D2s_v3' }] }),
    (err) => err.status === 400 && /confirm/i.test(err.message)
  );
});

test('missing targetSize is rejected', async () => {
  await assert.rejects(
    scale.resizeVms({ confirm: true, resources: [{ id: 'x' }] }),
    (err) => err.status === 400 && /targetSize/i.test(err.message)
  );
});

test('resize activity is recorded in the audit log', async () => {
  const vms = await scale.listVms();
  const vm = vms.find((v) => v.availableSizes.length > 1);
  const target = vm.availableSizes.find((s) => s.name !== vm.currentSize).name;

  await scale.resizeVms({ confirm: true, resources: [{ id: vm.id, targetSize: target }] });

  const audit = scale.getAudit();
  assert.ok(audit.length >= 1);
  assert.equal(audit[0].resources[0].id, vm.id);
  assert.equal(audit[0].resources[0].targetSize, target);
  assert.equal(audit[0].resources[0].status, 'resized');
});
