// Routes for cost data (overview trend, cost-by-service).

const express = require('express');
const router = express.Router();

const azureCostService = require('../services/azureCostService');

// Pull optional ?from=YYYY-MM-DD&to=YYYY-MM-DD off the request.
function parseRange(req) {
  const { from, to } = req.query;
  const range = {};
  if (from) range.from = from;
  if (to) range.to = to;
  return range;
}

// GET /api/costs/overview
router.get('/overview', async (req, res, next) => {
  try {
    const data = await azureCostService.getCostOverview(parseRange(req));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/costs/by-service
router.get('/by-service', async (req, res, next) => {
  try {
    const data = await azureCostService.getCostByService(parseRange(req));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
