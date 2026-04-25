// ── ACTIONS / AUDIT ROUTES ────────────────────────────────────
const express = require('express');
const router = express.Router();
const rulesEngine = require('../services/rules.engine');
const scheduler = require('../services/scheduler');
const meta = require('../services/meta.service');
const google = require('../services/google.service');
const launcher = require('../services/launcher');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for videos
});

// POST /api/actions/audit — run full audit now (on demand)
// GET also supported for Vercel Cron
router.all('/audit', async (req, res) => {
  try {
    const result = await rulesEngine.runFullAudit();
    scheduler.setLastAuditResult(result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/actions/audit/meta — run Meta audit only (GET for Vercel Cron)
router.all('/audit/meta', async (req, res) => {
  try { res.json(await rulesEngine.runMetaRules()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/actions/audit/google — run Google audit only
router.all('/audit/google', async (req, res) => {
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
    meta_account_id: process.env.META_AD_ACCOUNT_ID,
    meta_page_id: process.env.META_PAGE_ID,
    google_connected: !!process.env.GOOGLE_REFRESH_TOKEN,
    last_audit: scheduler.getLastAuditResult()?.timestamp || null,
    uptime_seconds: Math.floor(process.uptime()),
    node_env: process.env.NODE_ENV
  });
});

// POST /api/actions/update-token — update Meta token dynamically
router.post('/update-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });
  
  // Update in-memory for the current process
  process.env.META_ACCESS_TOKEN = token;
  
  // Also try to update .env file if it exists (for local dev)
  try {
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('META_ACCESS_TOKEN=')) {
        content = content.replace(/META_ACCESS_TOKEN=.*/, `META_ACCESS_TOKEN=${token}`);
      } else {
        content += `\nMETA_ACCESS_TOKEN=${token}`;
      }
      fs.writeFileSync(envPath, content);
    }
  } catch (e) {
    console.error('Failed to update .env file:', e.message);
  }

  res.json({ ok: true, message: 'Meta token updated successfully for the current session.' });
});

// POST /api/actions/launch-meta — One-click launch
router.post('/launch-meta', upload.array('files'), async (req, res) => {
  try {
    const config = {
      ...req.body,
      files: req.files
    };
    const result = await launcher.createMetaCampaign(config);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/actions/launch-google — One-click launch
router.post('/launch-google', async (req, res) => {
  try {
    const result = await launcher.createGoogleCampaign(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
