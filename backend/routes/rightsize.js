// Routes for right-sizing recommendations (suggest better VM sizes + savings).

const express = require('express');
const router = express.Router();

const rightsizeService = require('../services/rightsizeService');

// GET /api/rightsize — right-sizing recommendations for every VM.
router.get('/', async (req, res, next) => {
  try {
    res.json(await rightsizeService.getRecommendations());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
