// Route for the Idle Resource Hunter.

const express = require('express');
const router = express.Router();

const idleResourceService = require('../services/idleResourceService');
const destroyService = require('../services/destroyService');

// GET /api/idle
router.get('/', async (req, res, next) => {
  try {
    const data = await idleResourceService.getIdleResources();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/idle/destroy
// Body: { resources: [{ id, type, name?, monthlyCost? }], confirm: true }
// Permanently deletes the selected idle/orphaned resources. Requires an
// explicit `confirm: true`; see destroyService.js for per-type behavior.
router.post('/destroy', async (req, res, next) => {
  try {
    const result = await destroyService.destroyResources(req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/idle/destroy/audit — most recent destroy activity (in-memory,
// resets when the process restarts).
router.get('/destroy/audit', (req, res) => {
  res.json({ audit: destroyService.getAudit() });
});

module.exports = router;
