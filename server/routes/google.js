// ── GOOGLE ADS ROUTES ────────────────────────────────────────
const express = require('express');
const router = express.Router();
const google = require('../services/google.service');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// GET /api/google/test
router.get('/test', async (req, res) => {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: 'Google OAuth not completed',
      setup_url: `http://localhost:${process.env.PORT || 8008}/auth/google`
    });
  }
  try {
    const result = await google.testConnection();
    res.json(result);
  } catch (e) {
    const errMsg = e?.message || JSON.stringify(e) || e?.toString() || 'Unknown';
    const errDetails = e?.errors || e?.failure || e?.details || null;
    console.error('[GOOGLE TEST ERROR]', errMsg, JSON.stringify(errDetails));
    res.status(500).json({ ok: false, error: errMsg, details: errDetails, customer_id_used: process.env.GOOGLE_CUSTOMER_ID });
  }
});

// GET /api/google/summary
router.get('/summary', async (req, res) => {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return res.json({ skipped: true, reason: 'Google OAuth not configured', setup_url: '/auth/google' });
  }
  try { res.json(await google.getSummary()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/google/campaigns
router.get('/campaigns', async (req, res) => {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return res.json({ skipped: true, reason: 'Google OAuth not configured' });
  }
  try { res.json(await google.getCampaigns()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/google/metrics?period=LAST_7_DAYS
router.get('/metrics', async (req, res) => {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return res.json({ skipped: true });
  try {
    const period = req.query.period || 'LAST_7_DAYS';
    res.json(await google.getCampaignMetrics(period));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GOOGLE OAUTH ROUTES ──────────────────────────────────────
// GET /auth/google — start OAuth flow
router.get('/oauth-start', (req, res) => {
  const { GOOGLE_CLIENT_ID } = process.env;
  if (!GOOGLE_CLIENT_ID) return res.status(400).send('Set GOOGLE_CLIENT_ID in .env first');
  const scope = encodeURIComponent('https://www.googleapis.com/auth/adwords');
  const redirect = encodeURIComponent(`http://localhost:${process.env.PORT || 8008}/api/google/oauth-callback`);
  const url = `https://accounts.google.com/o/oauth2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  res.redirect(url);
});

// GET /api/google/oauth-callback — exchange code for refresh token
router.get('/oauth-callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code returned from Google');
  try {
    const redirect = `http://localhost:${process.env.PORT || 3001}/api/google/oauth-callback`;
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect,
        grant_type: 'authorization_code'
      }
    });
    const { refresh_token } = tokenRes.data;
    if (!refresh_token) return res.status(400).send('No refresh token returned — ensure prompt=consent was used');

    // Write to .env file
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refresh_token}`);
    fs.writeFileSync(envPath, envContent);
    process.env.GOOGLE_REFRESH_TOKEN = refresh_token;

    res.send(`
      <h2 style="font-family:sans-serif;color:#1B8A6B">✅ Google Ads Connected!</h2>
      <p style="font-family:sans-serif">Refresh token saved to .env. You can close this tab.</p>
      <p style="font-family:sans-serif">Now set <code>GOOGLE_CUSTOMER_ID</code> in your .env file (10-digit Google Ads account number).</p>
    `);
  } catch (e) {
    res.status(500).send(`OAuth error: ${e.response?.data?.error_description || e.message}`);
  }
});

module.exports = router;
