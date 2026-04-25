// ============================================================
// THABISA ADS AUTOPILOT — CRON SCHEDULER
// ============================================================
const cron = require('node-cron');
const logger = require('../utils/logger');
const rulesEngine = require('./rules.engine');

let lastAuditResult = null;
let schedulerStarted = false;

// ── CADENCE ──────────────────────────────────────────────────
// Every 24 hours at 9:00 AM — full daily audit
const DAILY_CRON    = '0 9 * * *';
// Every 3 days at 9:00 AM — budget shift review (Mon, Thu)
const THREE_DAY_CRON = '0 9 * * 1,4';
// Every Monday at 9:30 AM — weekly creative + bid audit
const WEEKLY_CRON   = '30 9 * * 1';
// Every 1st and 15th at 9:00 AM — bi-weekly full audit
const BIWEEKLY_CRON = '0 9 1,15 * *';

function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // ── DAILY AUDIT ──────────────────────────────────────────
  cron.schedule(DAILY_CRON, async () => {
    logger.info('SCHEDULER: Daily audit triggered');
    try {
      lastAuditResult = await rulesEngine.runFullAudit();
      logger.info('SCHEDULER: Daily audit complete', {
        meta_actions: lastAuditResult.meta?.actions?.length || 0,
        google_actions: lastAuditResult.google?.actions?.length || 0
      });
    } catch (err) {
      logger.error('SCHEDULER: Daily audit failed', { error: err.message });
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── 3-DAY BUDGET REVIEW ──────────────────────────────────
  cron.schedule(THREE_DAY_CRON, async () => {
    logger.info('SCHEDULER: 3-day budget shift review triggered');
    try {
      const result = await rulesEngine.runMetaRules();
      logger.info('SCHEDULER: Budget review complete', { actions: result.actions?.length || 0 });
    } catch (err) {
      logger.error('SCHEDULER: 3-day review failed', { error: err.message });
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── WEEKLY CREATIVE AUDIT ────────────────────────────────
  cron.schedule(WEEKLY_CRON, async () => {
    logger.info('SCHEDULER: Weekly creative audit triggered');
    try {
      const result = await rulesEngine.runFullAudit();
      logger.info('SCHEDULER: Weekly audit complete');
    } catch (err) {
      logger.error('SCHEDULER: Weekly audit failed', { error: err.message });
    }
  }, { timezone: 'Asia/Kolkata' });

  // ── BI-WEEKLY FULL AUDIT ─────────────────────────────────
  cron.schedule(BIWEEKLY_CRON, async () => {
    logger.info('SCHEDULER: Bi-weekly full audit triggered');
    try {
      const result = await rulesEngine.runFullAudit();
      logger.info('SCHEDULER: Bi-weekly audit complete');
    } catch (err) {
      logger.error('SCHEDULER: Bi-weekly audit failed', { error: err.message });
    }
  }, { timezone: 'Asia/Kolkata' });

  logger.info('SCHEDULER: All cron jobs registered', {
    daily: DAILY_CRON,
    three_day: THREE_DAY_CRON,
    weekly: WEEKLY_CRON,
    biweekly: BIWEEKLY_CRON,
    timezone: 'Asia/Kolkata'
  });
}

function getLastAuditResult() { return lastAuditResult; }
function setLastAuditResult(r) { lastAuditResult = r; }

module.exports = { startScheduler, getLastAuditResult, setLastAuditResult };
