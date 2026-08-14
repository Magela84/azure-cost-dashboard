// oidcAuth middleware tests.

const test = require('node:test');
const assert = require('node:assert');

const MODULE = require.resolve('../middleware/oidcAuth');

// First, exercise the module as it loads without any OIDC env vars (the
// Basic-auth fallback mode used by mock/demo and Basic-auth deployments).
delete process.env.OIDC_CLIENT_ID;
delete process.env.OIDC_CLIENT_SECRET;
delete process.env.OIDC_TENANT_ID;
delete process.env.OIDC_SESSION_SECRET;

const oidcAuth = require('../middleware/oidcAuth');

test('oidcEnabled is false when no OIDC env vars are set', () => {
  assert.strictEqual(oidcAuth.oidcEnabled(), false);
});

test('profile reports basic-auth mode with operator rights', () => {
  assert.deepStrictEqual(oidcAuth.profile({}), { auth: 'basic', canOperate: true });
});

test('apiGuard passes through when OIDC is disabled (Basic mode)', () => {
  let nextCalled = false;
  oidcAuth.apiGuard({}, {}, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true);
});

test('requireOperator passes through when OIDC is disabled (Basic mode)', () => {
  const mw = oidcAuth.requireOperator();
  let nextCalled = false;
  mw({}, {}, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true);
});

// ---------------------------------------------------------------------------
// Now reload the module with a full OIDC configuration present.
// ---------------------------------------------------------------------------
test('OIDC mode: guards enforce auth and operator role', () => {
  const saved = {};
  for (const k of ['OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_TENANT_ID', 'OIDC_SESSION_SECRET', 'OIDC_OPERATOR_ROLES', 'APP_BASE_URL']) {
    saved[k] = process.env[k];
  }
  process.env.OIDC_CLIENT_ID = 'client-id';
  process.env.OIDC_CLIENT_SECRET = 'client-secret';
  process.env.OIDC_TENANT_ID = 'tenant-id';
  process.env.OIDC_SESSION_SECRET = '0123456789abcdef';
  process.env.OIDC_OPERATOR_ROLES = 'Operator,CostOps';
  process.env.APP_BASE_URL = 'https://dashboard.example.com';

  delete require.cache[MODULE];
  const auth = require('../middleware/oidcAuth');

  try {
    assert.strictEqual(auth.oidcEnabled(), true);

    // A session secret shorter than 16 chars is rejected (fail-closed).
    process.env.OIDC_SESSION_SECRET = 'short';
    delete require.cache[MODULE];
    const weak = require('../middleware/oidcAuth');
    assert.strictEqual(weak.oidcEnabled(), false);
    process.env.OIDC_SESSION_SECRET = '0123456789abcdef';
    delete require.cache[MODULE];
    const auth2 = require('../middleware/oidcAuth');

    // claimRoles merges `roles` and `groups` claims.
    assert.deepStrictEqual(auth2.claimRoles({ roles: ['Reader'], groups: ['CostOps'] }), ['Reader', 'CostOps']);
    assert.deepStrictEqual(auth2.claimRoles({ roles: 'Operator' }), ['Operator']);

    // canOperate matches operator roles/group IDs.
    assert.strictEqual(auth2.canOperate({ roles: ['Operator'] }), true);
    assert.strictEqual(auth2.canOperate({ groups: ['CostOps'] }), true);
    assert.strictEqual(auth2.canOperate({ roles: ['Reader'] }), false);

    // apiGuard: unauthenticated -> 401 with a loginUrl; authenticated -> next().
    let unauthStatus = null;
    const unauthRes = {
      status: (c) => {
        unauthStatus = c;
        return { json: () => {} };
      },
    };
    auth2.apiGuard({ oidc: { isAuthenticated: () => false } }, unauthRes, () => {});
    assert.strictEqual(unauthStatus, 401);

    let authedNext = false;
    auth2.apiGuard({ oidc: { isAuthenticated: () => true } }, {}, () => {
      authedNext = true;
    });
    assert.strictEqual(authedNext, true);

    // requireOperator: operator -> next(); viewer -> 403.
    let operatorNext = false;
    auth2.requireOperator()({ oidc: { isAuthenticated: () => true, user: { roles: ['Operator'] } } }, {}, () => {
      operatorNext = true;
    });
    assert.strictEqual(operatorNext, true);

    let viewerStatus = null;
    const viewerRes = {
      status: (c) => {
        viewerStatus = c;
        return { json: () => {} };
      },
    };
    auth2.requireOperator()({ oidc: { isAuthenticated: () => true, user: { roles: ['Reader'] } } }, viewerRes, () => {});
    assert.strictEqual(viewerStatus, 403);

    // profile shape in OIDC mode.
    const prof = auth2.profile({ oidc: { user: { sub: 's1', name: 'Alice', roles: ['Operator'] } } });
    assert.strictEqual(prof.auth, 'oidc');
    assert.strictEqual(prof.name, 'Alice');
    assert.strictEqual(prof.canOperate, true);
  } finally {
    // Restore the original environment and module.
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    delete require.cache[MODULE];
    require('../middleware/oidcAuth');
  }
});
