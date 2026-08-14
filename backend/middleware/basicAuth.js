// Optional HTTP Basic Auth for the whole app.
//
// When AUTH_USER and AUTH_PASSWORD are both set, every request (except the
// health check) must present matching Basic credentials. This is a good fit for
// a single-origin deployment: the browser prompts once, then attaches the
// credentials to every same-origin request — including the SPA's /api fetches —
// so no secret is ever baked into the frontend bundle.
//
// In production with real Azure data, server.js refuses to start without auth
// (fail-closed). When the vars are unset, auth is disabled (convenient for
// local dev / mock mode).
//
// Brute-force protection: repeated failures from one client IP lock that IP out
// for a sliding window. Successful authentication clears the counter.

const crypto = require('crypto');

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

// ip -> { count, windowStart }
const failures = new Map();

function authEnabled() {
  return Boolean(process.env.AUTH_USER && process.env.AUTH_PASSWORD);
}

// Constant-time string comparison that tolerates differing lengths.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function recordFailure(ip) {
  const now = Date.now();
  const rec = failures.get(ip);
  if (!rec || now - rec.windowStart > WINDOW_MS) {
    failures.set(ip, { count: 1, windowStart: now });
    return 1;
  }
  rec.count += 1;
  return rec.count;
}

function clearFailures(ip) {
  failures.delete(ip);
}

function basicAuth(req, res, next) {
  if (!authEnabled()) return next();

  // Keep the health check open so container liveness probes don't need creds.
  if (req.path === '/api/health') return next();

  const ip = clientIp(req);

  // Lock the IP out while it is inside a window with too many failures.
  const rec = failures.get(ip);
  if (rec && rec.count >= MAX_FAILURES && Date.now() - rec.windowStart <= WINDOW_MS) {
    res.set('Retry-After', String(Math.ceil((rec.windowStart + WINDOW_MS - Date.now()) / 1000)));
    return res.status(429).json({ error: true, message: 'Too many failed login attempts. Try again later.' });
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString();
    const sep = decoded.indexOf(':');
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    if (safeEqual(user, process.env.AUTH_USER) && safeEqual(pass, process.env.AUTH_PASSWORD)) {
      clearFailures(ip);
      return next();
    }
  }

  recordFailure(ip);
  res.set('WWW-Authenticate', 'Basic realm="Azure Cost Dashboard"');
  return res.status(401).json({ error: true, message: 'Authentication required.' });
}

module.exports = basicAuth;
module.exports.authEnabled = authEnabled;
