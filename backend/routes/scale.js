// Routes for VM scaling (resize up/down).

const express = require('express');
const router = express.Router();

const scaleService = require('../services/scaleService');

// GET /api/scale/vms — list VMs with current size and available target sizes.
router.get('/vms', async (req, res, next) => {
  try {
    res.json({ vms: await scaleService.listVms() });
  } catch (err) {
    next(err);
  }
});

// POST /api/scale/vms/resize
// Body: { resources: [{ id, targetSize, currentSize? }], confirm: true }
// Resizes the selected VMs. May briefly restart running VMs; see scaleService.
router.post('/vms/resize', async (req, res, next) => {
  try {
    const result = await scaleService.resizeVms(req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/scale/audit — most recent resize activity (in-memory, resets on restart).
router.get('/audit', (req, res) => {
  res.json({ audit: scaleService.getAudit() });
});

module.exports = router;
