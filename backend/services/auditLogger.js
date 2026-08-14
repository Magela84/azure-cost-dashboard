// Durable audit logger shared by the mutating services (destroy, scale).
//
// Three tiers, in order of durability:
//   1. In-memory ring buffer  — serves the /audit API endpoints.
//   2. Append-only JSONL file — <backend>/logs/<name>-audit.jsonl (best effort;
//      still lost if the container is recycled).
//   3. Optional webhook       — POSTs each entry to AUDIT_WEBHOOK_URL so the
//      audit trail can live in a durable sink (Log Analytics, a SIEM, an
//      immutable blob…). Fire-and-forget; failures never affect the request.
//
// Entries are stored exactly as provided by the caller.

const fs = require('fs');
const path = require('path');

function createAuditLogger(name, { maxEntries = 200, fileDir = path.join(__dirname, '..', 'logs') } = {}) {
  const ring = [];
  const filePath = path.join(fileDir, `${name}-audit.jsonl`);

  function appendFile(entry) {
    try {
      fs.mkdirSync(fileDir, { recursive: true });
      fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`);
    } catch (_) {
      // Best-effort: the memory copy still serves the API.
    }
  }

  function forwardWebhook(entry) {
    const url = process.env.AUDIT_WEBHOOK_URL;
    if (!url) return;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {
      // Fire-and-forget: a dead webhook must never fail the mutation.
    });
  }

  function append(entry) {
    ring.unshift(entry);
    if (ring.length > maxEntries) ring.pop();
    appendFile(entry);
    forwardWebhook(entry);
  }

  function list() {
    return ring;
  }

  return { append, list };
}

module.exports = { createAuditLogger };
