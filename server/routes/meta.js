// ── META ROUTES ──────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const meta = require('../services/meta.service');

// GET /api/meta/test — connection health check
router.get('/test', async (req, res) => {
  try { res.json(await meta.testConnection()); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/meta/summary — dashboard summary (7d)
router.get('/summary', async (req, res) => {
  try { res.json(await meta.getSummary()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/meta/campaigns — all campaign list
router.get('/campaigns', async (req, res) => {
  try { res.json(await meta.getCampaigns()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/meta/insights?period=last_7d&level=campaign
router.get('/insights', async (req, res) => {
  try {
    const period = req.query.period || 'last_7d';
    const level = req.query.level || 'campaign';
    res.json(await meta.getInsights(period, level));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/meta/pixel — pixel health
router.get('/pixel', async (req, res) => {
  try { res.json(await meta.getPixelHealth()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/meta/pause-adset — manual pause trigger
router.post('/pause-adset', async (req, res) => {
  const { adSetId, reason } = req.body;
  if (!adSetId) return res.status(400).json({ error: 'adSetId required' });
  try { res.json(await meta.pauseAdSet(adSetId, reason || 'Manual pause via dashboard')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/meta/scale-budget
router.post('/scale-budget', async (req, res) => {
  const { campaignId, currentBudget, reason } = req.body;
  if (!campaignId || !currentBudget) return res.status(400).json({ error: 'campaignId and currentBudget required' });
  try { res.json(await meta.scaleBudget(campaignId, currentBudget, reason || 'Manual scale via dashboard')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/meta/library
router.get('/library', async (req, res) => {
  try { res.json(await meta.getLibraryAssets()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
