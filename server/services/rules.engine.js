// ============================================================
// THABISA ADS AUTOPILOT — RULES ENGINE (SURVIVAL MODE V3)
// ============================================================
const logger = require('../utils/logger');
const metaService = require('./meta.service');
const googleService = require('./google.service');
const notifier = require('./notifier');

// ── SURVIVAL CONFIGURATION ──────────────────────────────────
const TARGET_ROAS = 3.0;
const TARGET_CPP = 1200; 
const KILLSWITCH_THRESHOLD = 1500; 
const MIN_SPEND_FOR_AUDIT = 300;
const DRY_RUN = process.env.DRY_RUN !== 'false';

const roasHistory = {}; 

function recordRoas(id, roas) {
  if (!roasHistory[id]) roasHistory[id] = [];
  roasHistory[id].push({ date: new Date().toISOString().split('T')[0], roas });
  if (roasHistory[id].length > 7) roasHistory[id].shift();
}

const alerts = []; 
async function pushAlert(level, message, data = {}) {
  const alert = { level, message, data, timestamp: new Date().toISOString(), read: false };
  alerts.unshift(alert);
  if (alerts.length > 100) alerts.pop();
  logger.warn(`[ALERT][${level}] ${message}`, data);

  if (level === 'CRITICAL' || level === 'WARNING') {
    await notifier.sendAlert(level, message, data);
  }
}

function getAlerts() { return alerts; }
function markAlertsRead() { alerts.forEach(a => a.read = true); }

// ── META RULES ENGINE ────────────────────────────────────────
async function runMetaRules() {
  logger.info('Rules Engine: Starting Meta audit...');
  const actions = [];
  let summary;

  try {
    summary = await metaService.getSummary();
  } catch (err) {
    logger.error('Meta Summary fetch failed', { error: err.message });
    await pushAlert('CRITICAL', `Meta API connection failed: ${err.message}`);
    return { error: err.message, actions };
  }

  for (const campaign of summary.campaigns_detail) {
    try {
      const campId = campaign.campaign_id;
      if (!campId) continue;
      
      recordRoas(campId, campaign.roas);
      const currentSpend = parseFloat(campaign.spend || 0);
      const purchases = parseInt(campaign.purchases || 0);

      // 1. SCALE: ROAS ≥ 3.0
      if (campaign.roas >= TARGET_ROAS) {
        const currentBudget = parseFloat(campaign.daily_budget) || 1100;
        const result = await metaService.scaleBudget(campId, currentBudget, `High ROAS ${campaign.roas}x`);
        actions.push({ type: 'SCALE_BUDGET', campaign: campaign.campaign_name, roas: campaign.roas, result });
        await pushAlert('INFO', `Scaling: ${campaign.campaign_name} (ROAS ${campaign.roas}x)`);
      }

      // 2. KILLSWITCH: Spend > ₹1,500 with 0 sales
      if (purchases === 0 && currentSpend > KILLSWITCH_THRESHOLD) {
        const result = await metaService.pauseAdSet(campaign.adset_id || campId, `Killswitch: ₹${currentSpend} spent with 0 sales`);
        actions.push({ type: 'PAUSE_CAMPAIGN', campaign: campaign.campaign_name, spend: currentSpend, result });
        await pushAlert('CRITICAL', `Killswitch: ${campaign.campaign_name} paused (₹${currentSpend} spend, 0 sales)`);
      }

      // 3. EFFICIENCY: High CPP slowdown
      if (purchases > 0 && campaign.cpp > TARGET_CPP) {
        const currentBudget = parseFloat(campaign.daily_budget) || 1100;
        const result = await metaService.decreaseBudget(campId, currentBudget, `High CPP ₹${campaign.cpp}`);
        actions.push({ type: 'DECREASE_BUDGET', campaign: campaign.campaign_name, cpp: campaign.cpp, result });
        await pushAlert('WARNING', `High CPP: Slowing ${campaign.campaign_name} (₹${campaign.cpp})`);
      }

    } catch (err) {
      logger.error(`Error auditing Meta campaign ${campaign.campaign_name}`, { error: err.message });
    }
  }

  return {
    platform: 'META',
    timestamp: new Date().toISOString(),
    summary: { ...summary },
    actions
  };
}

// ── GOOGLE RULES ENGINE ──────────────────────────────────────
async function runGoogleRules() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return { skipped: true };

  logger.info('Rules Engine: Starting Google audit...');
  const actions = [];
  let summary;

  try {
    summary = await googleService.getSummary();
  } catch (err) {
    logger.error('Google Summary fetch failed', { error: err.message });
    return { error: err.message, actions };
  }

  for (const campaign of summary.campaigns_detail) {
    try {
      const campId = campaign.campaign_id;
      if (!campId) continue;
      
      const currentSpend = parseFloat(campaign.spend || 0);
      const conversions = parseInt(campaign.conversions || 0);

      // 1. KILLSWITCH: Spend > ₹1,500 with 0 conversions
      if (conversions === 0 && currentSpend > KILLSWITCH_THRESHOLD) {
        const result = await googleService.pauseCampaign(campId, `Killswitch: ₹${currentSpend} spent with 0 conversions`);
        actions.push({ type: 'PAUSE_GOOGLE', campaign: campaign.campaign_name, spend: currentSpend, result });
        await pushAlert('CRITICAL', `Google Killswitch: ${campaign.campaign_name} paused (₹${currentSpend} spend, 0 sales)`);
      }

      // 2. EFFICIENCY: High CPP flag
      if (conversions > 0 && campaign.cpp > TARGET_CPP) {
        await pushAlert('WARNING', `Google High CPP: ${campaign.campaign_name} (₹${campaign.cpp})`);
      }

    } catch (err) {
      logger.error(`Error auditing Google campaign ${campaign.campaign_name}`, { error: err.message });
    }
  }

  return {
    platform: 'GOOGLE',
    timestamp: new Date().toISOString(),
    summary: { ...summary },
    actions
  };
}

// ── FULL AUDIT ───────────────────────────────────────────────
async function runFullAudit() {
  logger.info('=== THABISA AUTOPILOT: FULL AUDIT STARTING ===');
  const [metaResult, googleResult] = await Promise.allSettled([
    runMetaRules(),
    runGoogleRules()
  ]);

  const result = {
    timestamp: new Date().toISOString(),
    meta: metaResult.status === 'fulfilled' ? metaResult.value : { error: metaResult.reason?.message },
    google: googleResult.status === 'fulfilled' ? googleResult.value : { error: googleResult.reason?.message }
  };

  await notifier.sendSummary(result);
  return result;
}

module.exports = { runMetaRules, runGoogleRules, runFullAudit, getAlerts, markAlertsRead, pushAlert };
