// Unit tests for the Right-Sizing feature, exercised through the mock data
// path (no Azure credentials needed). Utilization comes from the mock catalog.

const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.MOCK_DATA = 'true';
const rightsize = require('../services/rightsizeService');

test.beforeEach(() => {
  require('../services/scaleService').resetMock();
});

test('mock recommendations only include actionable VMs', async () => {
  const res = await rightsize.getRecommendations();

  assert.equal(res.currency, 'USD');
  assert.ok(res.count >= 3, `expected several recommendations, got ${res.count}`);
  assert.ok(res.totalMonthlySavings > 0, 'expected positive total savings');

  for (const r of res.recommendations) {
    assert.ok(r.id.startsWith('/subscriptions/'));
    assert.ok(['up', 'down'].includes(r.direction));
    assert.ok(r.currentSize, 'has current size');
    assert.ok(r.recommendedSize && r.recommendedSize !== r.currentSize);
    assert.ok(r.monthlyCost > 0);
    assert.equal(typeof r.avgCpuPct, 'number');
    assert.equal(typeof r.avgMemoryPct, 'number');
    assert.equal(typeof r.monthlySavings, 'number');
    assert.ok(r.estimatedUtilAfterPct >= 0 && r.estimatedUtilAfterPct <= 100);
  }
});

test('over-provisioned VM gets a downsize recommendation with savings', async () => {
  const res = await rightsize.getRecommendations();
  const batch = res.recommendations.find((r) => r.name === 'vm-batch-legacy');

  assert.ok(batch, 'vm-batch-legacy should be recommended');
  assert.equal(batch.direction, 'down');
  assert.equal(batch.recommendedSize, 'Standard_F2s_v2');
  assert.equal(batch.currentSize, 'Standard_F4s_v2');
  // (0.168 - 0.084) * 730 hours
  assert.equal(batch.monthlySavings, 61.32);
  assert.equal(batch.monthlyCost, 122.64);
});

test('under-provisioned VM gets an upsize recommendation', async () => {
  const res = await rightsize.getRecommendations();
  const db = res.recommendations.find((r) => r.name === 'vm-db-primary');

  assert.ok(db, 'vm-db-primary should be recommended');
  assert.equal(db.direction, 'up');
  assert.equal(db.recommendedSize, 'Standard_E32s_v3');
  assert.ok(db.monthlySavings < 0, 'upsize has a negative (added cost) monthlySavings');
  assert.ok(res.totalMonthlyCostRisk > 0, 'upsize risk is summarized');
});

test('well-utilized VMs are not recommended', async () => {
  const res = await rightsize.getRecommendations();
  const names = res.recommendations.map((r) => r.name);
  assert.ok(!names.includes('vm-prod-01'), 'vm-prod-01 is a good fit and should be excluded');
  assert.ok(!names.includes('vm-analytics-old'), 'vm-analytics-old is a good fit and should be excluded');
});

test('recommendations are sorted by savings, descending', async () => {
  const res = await rightsize.getRecommendations();
  for (let i = 1; i < res.recommendations.length; i++) {
    assert.ok(
      res.recommendations[i - 1].monthlySavings >= res.recommendations[i].monthlySavings,
      'sorted by monthlySavings desc'
    );
  }
});
