// ============================================================
// THABISA ADS AUTOPILOT — EXPRESS SERVER
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const { startScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// ── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors({ origin: '*' })); // Allow file:// and localhost origins
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  if (req.path !== '/api/actions/status') { // skip noisy status polls
    logger.info(`${req.method} ${req.path}`);
  }
  next();
});

// ── ROUTES ───────────────────────────────────────────────────
app.use('/api/meta', require('./routes/meta'));
app.use('/api/google', require('./routes/google'));
app.use('/api/actions', require('./routes/actions'));

// Auth redirect shortcut
app.get('/auth/google', (req, res) => res.redirect('/api/google/oauth-start'));

// ── STATUS ROOT ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'Thabisa Ads Autopilot Server',
    version: '1.0.0',
    status: 'running',
    dry_run: process.env.DRY_RUN !== 'false',
    endpoints: {
      meta_test:       'GET  /api/meta/test',
      meta_summary:    'GET  /api/meta/summary',
      meta_campaigns:  'GET  /api/meta/campaigns',
      meta_insights:   'GET  /api/meta/insights',
      google_test:     'GET  /api/google/test',
      google_summary:  'GET  /api/google/summary',
      google_oauth:    'GET  /auth/google',
      run_audit:       'POST /api/actions/audit',
      last_audit:      'GET  /api/actions/last-audit',
      alerts:          'GET  /api/actions/alerts',
      logs:            'GET  /api/actions/logs',
      status:          'GET  /api/actions/status'
    }
  });
});

// ── ERROR HANDLER ────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, path: req.path });
  res.status(500).json({ error: err.message });
});

// ── START ────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`✅ Thabisa Autopilot Server running on http://localhost:${PORT}`);
  logger.info(`   DRY RUN: ${process.env.DRY_RUN !== 'false' ? 'ON (no live changes)' : '⚠️  OFF — LIVE MODE'}`);
  logger.info(`   Meta account: ${process.env.META_AD_ACCOUNT_ID}`);
  logger.info(`   Target ROAS: ${process.env.TARGET_ROAS}× | Target CPP: ₹${process.env.TARGET_CPP}`);
  logger.info(`   Google Ads: ${process.env.GOOGLE_REFRESH_TOKEN ? '✅ Connected' : '⏳ Not connected — visit /auth/google'}`);

  // Start cron scheduler
  startScheduler();
  logger.info('   Scheduler: All cron jobs active (24h, 3d, 7d, 14d cadence)');
});

module.exports = app;
