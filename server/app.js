// ============================================================
// THABISA ADS AUTOPILOT — EXPRESS APP (shared between local + Vercel)
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const { metaTokenStorage } = require('./services/meta.service');

const app = express();

// ── STATIC FILES ─────────────────────────────────────────────
// Serve dashboard (index.html, styles.css, app.js, data.js) from project root
const projectRoot = path.join(__dirname, '..');
app.use(express.static(projectRoot, { index: 'index.html' }));

// ── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Token-persistence middleware (header override)
app.use((req, res, next) => {
  const token = req.headers['x-meta-token'];
  if (token) {
    metaTokenStorage.run(token, () => next());
  } else {
    next();
  }
});

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

// ── ROOT — serve dashboard ───────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// ── ERROR HANDLER ────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, path: req.path });
  res.status(500).json({ error: err.message });
});

module.exports = app;
