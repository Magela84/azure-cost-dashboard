// Unit tests for the Destroy feature, exercised through the mock data path
// (no Azure credentials needed). Mock "destroys" mark findings as destroyed so
// they drop out of the idle scan.

const { test } = require('node:test');
const assert = require('node:assert/strict');

// The services read MOCK_DATA at call time, so set it before requiring.
process.env.MOCK_DATA = 'true';
const idle = require('../services/idleResourceService');
const destroy = require('../services/destroyService');

test.beforeEach(() => {
  idle.resetMockDestroyed();
});

test('destroying a resource succeeds and removes it from the idle scan', async () => {
  const before = await idle.getIdleResources();
  const target = before.findings[0];

  const result = await destroy.destroyResources({
    confirm: true,
    resources: [{ id: target.id, type: target.type, name: target.name, monthlyCost: target.monthlyCost }],
  });

  assert.equal(result.requested, 1);
  assert.equal(result.failed.length, 0);
  assert.equal(result.succeeded.length, 1);
  assert.equal(result.succeeded[0].id, target.id);
  assert.equal(result.totalPotentialMonthlySavings, target.monthlyCost);

  const after = await idle.getIdleResources();
  assert.ok(!after.findings.some((f) => f.id === target.id), 'destroyed resource still listed');
});

test('destroying the same resource twice reports a failure', async () => {
  const before = await idle.getIdleResources();
  const target = before.findings[0];
  const payload = { confirm: true, resources: [{ id: target.id, type: target.type }] };

  await destroy.destroyResources(payload);
  const result = await destroy.destroyResources(payload);

  assert.equal(result.succeeded.length, 0);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].error, /already destroyed/i);
});

test('unknown resource id fails without affecting the scan', async () => {
  const before = await idle.getIdleResources();
  const result = await destroy.destroyResources({
    confirm: true,
    resources: [{ id: 'nope-123', type: 'Idle VM' }],
  });

  assert.equal(result.succeeded.length, 0);
  assert.equal(result.failed.length, 1);
  const after = await idle.getIdleResources();
  assert.equal(after.findingCount, before.findingCount);
});

test('missing confirm is rejected', async () => {
  await assert.rejects(
    destroy.destroyResources({ resources: [{ id: 'disk-1', type: 'Unattached Disk' }] }),
    (err) => err.status === 400 && /confirm/i.test(err.message)
  );
});

test('unknown resource type is rejected', async () => {
  await assert.rejects(
    destroy.destroyResources({ confirm: true, resources: [{ id: 'x', type: 'Database' }] }),
    (err) => err.status === 400 && /Unsupported resource type/i.test(err.message)
  );
});

test('empty resources array is rejected', async () => {
  await assert.rejects(
    destroy.destroyResources({ confirm: true, resources: [] }),
    (err) => err.status === 400
  );
});

test('destroy activity is recorded in the audit log', async () => {
  const before = await idle.getIdleResources();
  const target = before.findings[0];

  await destroy.destroyResources({
    confirm: true,
    resources: [{ id: target.id, type: target.type }],
  });

  const audit = destroy.getAudit();
  assert.ok(audit.length >= 1);
  assert.equal(audit[0].resources[0].id, target.id);
  assert.equal(audit[0].resources[0].status, 'destroyed');
});
