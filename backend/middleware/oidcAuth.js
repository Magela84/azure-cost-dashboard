// Entra ID / Microsoft Entra OIDC authentication via express-openid-connect.
//
// Enabled when OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_TENANT_ID,
// OIDC_SESSION_SECRET (>= 16 chars) and APP_BASE_URL are all set. When enabled
// it replaces HTTP Basic Auth for the whole app:
//   - unauthenticated /api calls get 401 JSON with a loginUrl hint
//   - GET /api/auth/profile returns the signed-in user + RBAC flags
//   - destructive endpoints (destroy/resize) require an operator role
//   - login / logout are served at /api/auth/login and /api/auth/logout
//
// APP_BASE_URL is required because the library needs an explicit base URL to
// build the redirect URIs registered on the identity provider.
//
// When OIDC is not configured these middleware pass through and the caller's
// Basic-auth middleware handles authentication instead.
//
// RBAC: a user may act as an operator when any of the roles/group IDs listed in
// OIDC_OPERATOR_ROLES (comma-separated) appears in their `roles` or `groups`
// claim. Configure app roles or group claims in Entra ID accordingly.

const { auth } = require('express-openid-connect');

const TENANT_ID = process.env.OIDC_TENANT_ID || process.env.AZURE_TENANT_ID || '';
const CLIENT_ID = process.env.OIDC_CLIENT_ID || '';
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
const SESSION_SECRET = process.env.OIDC_SESSION_SECRET || '';
const APP_BASE_URL = process.env.APP_BASE_URL || '';

const OPERATOR_ROLES = (process.env.OIDC_OPERATOR_ROLES || 'Operator')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function oidcEnabled() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && TENANT_ID && SESSION_SECRET.length >= 16 && APP_BASE_URL);
}

function config() {
  return {
    authRequired: false,
    issuerBaseURL: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    baseURL: APP_BASE_URL,
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    secret: SESSION_SECRET,
    authorizationParams: {
      response_type: 'code',
      scope: 'openid profile email',
    },
    routes: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      callback: '/api/auth/callback',
      postLogoutRedirect: '/',
    },
    session: {
      name: 'appSession',
      cookie: {
        httpOnly: true,
        // Secure behind HTTPS; the library also derives this from baseURL.
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
      },
    },
  };
}

// express-openid-connect middleware (only meaningful when oidcEnabled()).
function middleware() {
  return auth(config());
}

// Collect role-ish claims (`roles` from Entra app roles, `groups` for group
// claims configured to be emitted on tokens).
function claimRoles(user) {
  if (!user) return [];
  const seen = new Set();
  for (const key of ['roles', 'groups']) {
    const val = user[key];
    if (Array.isArray(val)) val.forEach((v) => seen.add(String(v)));
    else if (typeof val === 'string') seen.add(val);
  }
  return [...seen];
}

function canOperate(user) {
  if (!OPERATOR_ROLES.length) return true;
  const roles = claimRoles(user);
  return OPERATOR_ROLES.some((r) => roles.includes(r));
}

// Shape returned by GET /api/auth/profile.
function profile(req) {
  if (!oidcEnabled()) return { auth: 'basic', canOperate: true };
  const user = (req.oidc && req.oidc.user) || {};
  return {
    auth: 'oidc',
    id: user.sub || null,
    name: user.name || user.preferred_username || user.upn || 'User',
    email: user.email || user.upn || null,
    roles: claimRoles(user),
    canOperate: canOperate(user),
  };
}

// 401 guard for /api routes. In Basic-auth mode it passes through (the basicAuth
// middleware already authenticated the request).
function apiGuard(req, res, next) {
  if (!oidcEnabled()) return next();
  if (req.oidc && req.oidc.isAuthenticated()) return next();
  return res.status(401).json({
    error: true,
    message: 'Authentication required.',
    loginUrl: '/api/auth/login',
  });
}

// Operator-only guard for destructive endpoints. In Basic-auth mode the single
// shared credential is treated as an operator.
function requireOperator() {
  return (req, res, next) => {
    if (!oidcEnabled()) return next();
    if (!req.oidc || !req.oidc.isAuthenticated()) {
      return res.status(401).json({ error: true, message: 'Authentication required.' });
    }
    if (canOperate(req.oidc.user)) return next();
    return res.status(403).json({
      error: true,
      message: 'Forbidden: the Operator role is required for this action.',
    });
  };
}

module.exports = { oidcEnabled, middleware, apiGuard, requireOperator, profile, claimRoles, canOperate };
