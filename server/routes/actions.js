// ── ACTIONS / AUDIT ROUTES ────────────────────────────────────
const express = require('express');
const router = express.Router();
const rulesEngine = require('../services/rules.engine');
const scheduler = require('../services/scheduler');
const fs = require('fs');
const path = require('path');

// GET /api/actions/audit — run full audit now (on demand)
router.post('/audit', async (req, res) => {
  try {
    const result = await rulesEngine.runFullAudit();
    scheduler.setLastAuditResult(result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/actions/audit/meta — run Meta audit only
router.post('/audit/meta', async (req, res) => {
  try { res.json(await rulesEngine.runMetaRules()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/actions/audit/google — run Google audit only
router.post('/audit/google', async (req, res) => {
  try { res.json(await rulesEngine.runGoogleRules()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/actions/last-audit — get last audit result
router.get('/last-audit', (req, res) => {
  const result = scheduler.getLastAuditResult();
  if (!result) return res.json({ message: 'No audit run yet. POST /api/actions/audit to trigger one.' });
  res.json(result);
});

// GET /api/actions/alerts — get all alerts
router.get('/alerts', (req, res) => {
  res.json(rulesEngine.getAlerts());
});

// POST /api/actions/alerts/read — mark alerts as read
router.post('/alerts/read', (req, res) => {
  rulesEngine.markAlertsRead();
  res.json({ ok: true });
});

// GET /api/actions/logs — tail the actions log file
router.get('/logs', (req, res) => {
  const logPath = path.join(__dirname, '..', 'logs', 'actions.log');
  if (!fs.existsSync(logPath)) return res.json([]);
  const lines = fs.readFileSync(logPath, 'utf8')
    .split('\n').filter(Boolean)
    .slice(-100) // last 100 entries
    .map(line => { try { return JSON.parse(line); } catch { return { raw: line }; } })
    .reverse();
  res.json(lines);
});

// GET /api/actions/status — autopilot status
router.get('/status', (req, res) => {
  res.json({
    dry_run: process.env.DRY_RUN !== 'false',
    target_roas: parseFloat(process.env.TARGET_ROAS || 3),
    target_cpp_inr: parseFloat(process.env.TARGET_CPP || 2500),
    min_spend_inr: parseFloat(process.env.MIN_SPEND_BEFORE_PAUSE || 1000),
    currency: process.env.CURRENCY || 'INR',
    meta_connected: !!process.env.META_ACCESS_TOKEN,
    google_connected: !!process.env.GOOGLE_REFRESH_TOKEN,
    last_audit: scheduler.getLastAuditResult()?.timestamp || null,
    uptime_seconds: Math.floor(process.uptime()),
    node_env: process.env.NODE_ENV
  });
});

module.exports = router;
