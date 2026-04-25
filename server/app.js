// ============================================================
// THABISA ADS AUTOPILOT — EXPRESS APP (shared between local + Vercel)
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');

const app = express();

// ── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.path !== '/api/actions/status') {
    logger.info(`${req.method} ${req.path}`);
  }
  next();
});

// ── ROUTES ───────────────────────────────────────────────────
app.use('/api/meta', require('./routes/meta'));
app.use('/api/google', require('./routes/google'));
app.use('/api/actions', require('./routes/actions'));

app.get('/auth/google', (req, res) => res.redirect('/api/google/oauth-start'));

// ── ROOT ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'Thabisa Ads Autopilot Server',
    version: '1.0.0',
    status: 'running',
    dry_run: process.env.DRY_RUN !== 'false',
    runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-local',
    endpoints: {
      meta_test:       'GET  /api/meta/test',
      meta_summary:    'GET  /api/meta/summary',
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

module.exports = app;
