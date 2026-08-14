// Azure Cost Visibility Dashboard - Express server entry point.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const costsRouter = require('./routes/costs');
const alertsRouter = require('./routes/alerts');
const logicAppsRouter = require('./routes/logicapps');
const analystRouter = require('./routes/analyst');
const idleRouter = require('./routes/idle');
const scaleRouter = require('./routes/scale');
const rightsizeRouter = require('./routes/rightsize');
const errorHandler = require('./middleware/errorHandler');
const basicAuth = require('./middleware/basicAuth');
const oidcAuth = require('./middleware/oidcAuth');

const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// Fail-closed configuration checks.
//
// In production with REAL Azure data, the app must not start unauthenticated or
// without a subscription id — it can delete resources and resize VMs. Mock mode
// (demo data only) is exempt so the demo deployment still works.
// ---------------------------------------------------------------------------
function assertSafeConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const realMode = process.env.MOCK_DATA !== 'true';

  const authAvailable = oidcAuth.oidcEnabled() || basicAuth.authEnabled();
  if (realMode && !authAvailable) {
    throw new Error(
      'Refusing to start: production server with real Azure data but no authentication. ' +
      'Set OIDC_CLIENT_ID/OIDC_CLIENT_SECRET/OIDC_TENANT_ID/OIDC_SESSION_SECRET/APP_BASE_URL (Entra ID), ' +
      'or AUTH_USER and AUTH_PASSWORD (Basic Auth).'
    );
  }
  if (realMode && !process.env.AZURE_SUBSCRIPTION_ID) {
    throw new Error(
      'Refusing to start: production server with real Azure data but AZURE_SUBSCRIPTION_ID is not set.'
    );
  }
}

// ---------------------------------------------------------------------------
// Trust one reverse-proxy hop (Render / App Service / nginx) so req.ip and
// rate limiting see the real client address from X-Forwarded-For.
// ---------------------------------------------------------------------------
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Security headers (CSP, frame-ancestors against clickjacking, HSTS, nosniff…).
// ---------------------------------------------------------------------------
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));

// ---------------------------------------------------------------------------
// CORS: restricted to an explicit allowlist. With no CORS_ORIGINS configured the
// app is single-origin, so cross-origin requests are simply not permitted.
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins, credentials: true }));
}

// ---------------------------------------------------------------------------
// Request parsing with an explicit body size cap (the default 100kb is fine;
// being explicit also avoids the body-parser limit-disabling advisory).
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '100kb' }));

// ---------------------------------------------------------------------------
// Reject state-changing requests from unexpected origins (CSRF defense). The
// SPA is same-origin, so any Origin that is not our own host or an explicit
// allowlist entry is blocked before it reaches the routes.
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

  const origin = req.get('Origin');
  if (!origin) return next(); // same-origin, curl, server-to-server

  const own =
    `${req.protocol}://${req.get('Host')}`.replace(/\/$/, '').toLowerCase();
  const candidate = origin.replace(/\/$/, '').toLowerCase();

  if (candidate === own || allowedOrigins.some((o) => o.toLowerCase() === candidate)) {
    return next();
  }
  return res.status(403).json({ error: true, message: 'Cross-origin request denied.' });
});

// ---------------------------------------------------------------------------
// Rate limiting. Generous per-IP caps; the destructive and cost-incurring
// endpoints get far tighter limits. /api/health stays open for probes.
// ---------------------------------------------------------------------------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: true, message: 'Too many requests — slow down.' },
});

const destructiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: true, message: 'Too many destructive operations — slow down.' },
});

const analystLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: true, message: 'Too many analyst questions — slow down.' },
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  return apiLimiter(req, res, next);
});

// Authentication: Entra ID / OIDC when configured (enterprise sign-in with
// RBAC), otherwise HTTP Basic Auth (AUTH_USER/AUTH_PASSWORD). Both are required
// in production with real data; see assertSafeConfig.
if (oidcAuth.oidcEnabled()) {
  app.use(oidcAuth.middleware());
} else {
  app.use(basicAuth);
}

// Health check (exempt from auth inside the middleware).
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Who am I? The SPA calls this on load to decide between the login screen and
// the dashboard, and to learn the user's RBAC flags.
app.get('/api/auth/profile', (req, res) => {
  if (oidcAuth.oidcEnabled() && (!req.oidc || !req.oidc.isAuthenticated())) {
    return res.status(401).json({
      error: true,
      message: 'Authentication required.',
      loginUrl: '/api/auth/login',
    });
  }
  res.json(oidcAuth.profile(req));
});

// OIDC-only guard for the rest of /api (Basic-auth mode is handled by the
// basicAuth middleware already mounted above).
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/auth')) return next();
  return oidcAuth.apiGuard(req, res, next);
});

// API routes
app.use('/api/costs', costsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/logicapps', logicAppsRouter);
app.use('/api/analyst', analystLimiter, analystRouter);
app.use('/api/rightsize', rightsizeRouter);

// The two endpoints that can permanently change Azure state get a strict cap
// and require the Operator role. Mounted BEFORE their routers so the limiter
// actually runs for the POST.
app.use('/api/idle/destroy', destructiveLimiter, oidcAuth.requireOperator());
app.use('/api/idle', idleRouter);
app.use('/api/scale/vms/resize', destructiveLimiter, oidcAuth.requireOperator());
app.use('/api/scale', scaleRouter);

// In a production build, serve the compiled frontend from this same origin so
// the SPA and its /api calls share one host (and one set of Basic credentials).
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback: any non-API route returns index.html.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Central error handler — must be registered after routes.
app.use(errorHandler);

try {
  assertSafeConfig();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(`[startup] ${err.message}`);
  process.exit(1);
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Azure Cost Dashboard backend listening on port ${PORT}`);
  if (oidcAuth.oidcEnabled()) {
    // eslint-disable-next-line no-console
    console.log('[auth] Entra ID / OIDC authentication enabled.');
  } else if (!basicAuth.authEnabled()) {
    // eslint-disable-next-line no-console
    console.warn(
      '[auth] No authentication configured — API is unauthenticated. This is only allowed in mock/demo mode; production with real data refuses to start.'
    );
  } else {
    // eslint-disable-next-line no-console
    console.log('[auth] HTTP Basic Auth enabled.');
  }
});

module.exports = app;
