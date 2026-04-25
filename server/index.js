// ============================================================
// THABISA ADS AUTOPILOT — LOCAL SERVER ENTRY POINT
// ============================================================
require('dotenv').config();
const logger = require('./utils/logger');
const app = require('./app');
const { startScheduler } = require('./services/scheduler');

const PORT = process.env.PORT || 8008;

app.listen(PORT, () => {
  logger.info(`✅ Thabisa Autopilot Server running on http://localhost:${PORT}`);
  logger.info(`   DRY RUN: ${process.env.DRY_RUN !== 'false' ? 'ON (no live changes)' : '⚠️  OFF — LIVE MODE'}`);
  logger.info(`   Meta account: ${process.env.META_AD_ACCOUNT_ID}`);
  logger.info(`   Target ROAS: ${process.env.TARGET_ROAS}× | Target CPP: ₹${process.env.TARGET_CPP}`);
  logger.info(`   Google Ads: ${process.env.GOOGLE_REFRESH_TOKEN ? '✅ Connected' : '⏳ Not connected — visit /auth/google'}`);
  startScheduler();
  logger.info('   Scheduler: All cron jobs active (24h, 3d, 7d, 14d cadence)');
});

module.exports = app;
