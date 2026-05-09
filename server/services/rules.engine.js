// ============================================================
// THABISA ADS AUTOPILOT — RULES ENGINE (SURVIVAL MODE V3)
// ============================================================
const logger = require('../utils/logger');
const metaService = require('./meta.service');
const googleService = require('./google.service');
const notifier = require('./notifier');

// ── SURVIVAL CONFIGURATION (RESCUE MODE) ─────────────────────
const TARGET_ROAS = 3.0;
const MIN_VIABLE_ROAS = 1.5; // ABSOLUTE MINIMUM TO STAY ACTIVE
const TARGET_CPP = 1200; 
const KILLSWITCH_THRESHOLD = 500; // PAUSE FASTER (WAS 1500)
const MIN_SPEND_FOR_AUDIT = 200;
const GLOBAL_BUDGET_CAP = 150000; // Updated to accommodate previous spend + new activity
const REMAINING_DAILY_LIMIT = 2000; // New daily limit for active monitoring
const DRY_RUN = process.env.DRY_RUN === 'true'; // DEFAULT TO LIVE MODE

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

      // 1. GUARDIAN PAUSE: ROAS < 1.5x (RESCUE MODE)
      if (currentSpend > MIN_SPEND_FOR_AUDIT && campaign.roas < MIN_VIABLE_ROAS) {
        const result = await metaService.pauseAdSet(campaign.adset_id || campId, `Guardian: Low ROAS ${campaign.roas}x`);
        actions.push({ type: 'PAUSE_CAMPAIGN', campaign: campaign.campaign_name, roas: campaign.roas, result });
        await pushAlert('CRITICAL', `Rescue Mode: ${campaign.campaign_name} paused (ROAS ${campaign.roas}x < 1.5x)`);
        continue; // Skip other rules for this campaign
      }

      // 2. SCALE: ROAS ≥ 3.0
      if (campaign.roas >= TARGET_ROAS) {
        const currentBudget = parseFloat(campaign.daily_budget) || 1100;
        // Limit scaling budget to fit the daily limit
        const result = await metaService.scaleBudget(campId, Math.min(currentBudget, REMAINING_DAILY_LIMIT), `High ROAS ${campaign.roas}x`);
        actions.push({ type: 'SCALE_BUDGET', campaign: campaign.campaign_name, roas: campaign.roas, result });
        await pushAlert('INFO', `Scaling: ${campaign.campaign_name} (ROAS ${campaign.roas}x)`);
      }

      // 3. KILLSWITCH: Spend > ₹500 with 0 sales
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

      // 1. GUARDIAN PAUSE: ROAS < 1.5x (RESCUE MODE)
      if (currentSpend > MIN_SPEND_FOR_AUDIT && campaign.roas < MIN_VIABLE_ROAS) {
        const result = await googleService.pauseCampaign(campId, `Guardian: Low ROAS ${campaign.roas}x`);
        actions.push({ type: 'PAUSE_GOOGLE', campaign: campaign.campaign_name, roas: campaign.roas, result });
        await pushAlert('CRITICAL', `Rescue Mode: Google ${campaign.campaign_name} paused (ROAS ${campaign.roas}x < 1.5x)`);
        continue;
      }

      // 2. KILLSWITCH: Spend > ₹500 with 0 conversions
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

// ── GLOBAL GUARDIAN ─────────────────────────────────────────
async function checkGlobalGuardian() {
  logger.info('Checking Global Guardian constraints...');
  const now = new Date();
  const planStart = new Date('2026-05-01');
  const formatDate = (d) => d.toISOString().split('T')[0];
  const timeRange = { since: formatDate(planStart), until: formatDate(now) };

  const [metaSum, googleSum] = await Promise.all([
    metaService.getInsights(null, 'campaign', timeRange).catch(() => []),
    googleService.getSummary().catch(() => ({ total_spend: 0 })) // Fallback for Google
  ]);

  const metaTotal = metaSum.reduce((sum, r) => sum + parseFloat(r.spend), 0);
  const googleTotal = googleSum.total_spend || 0;
  const grandTotal = metaTotal + googleTotal;

  logger.info(`Global Guardian: Total 10-Day Spend to date: ₹${grandTotal}`);

  if (grandTotal >= GLOBAL_BUDGET_CAP) {
    await pushAlert('CRITICAL', `GLOBAL BUDGET CAP REACHED (₹${grandTotal}). SHUTTING DOWN ALL SPENDING.`);
    
    // Pause ALL active Meta campaigns
    const metaCamps = await metaService.getCampaigns();
    for (const c of metaCamps) {
      if (c.status === 'ACTIVE') {
        await metaService.pauseAdSet(c.id, 'GLOBAL BUDGET CAP EXCEEDED');
      }
    }

    // Pause ALL active Google campaigns
    const googleCamps = await googleService.getCampaigns();
    for (const c of googleCamps) {
      if (c.status === 2) { // ENABLED
        await googleService.pauseCampaign(c.id, 'GLOBAL BUDGET CAP EXCEEDED');
      }
    }
    return true; // Cap reached
  }
  return false; // Cap not reached
}

// ── FULL AUDIT ───────────────────────────────────────────────
async function runFullAudit() {
  logger.info('=== THABISA AUTOPILOT: FULL AUDIT STARTING ===');
  
  const capReached = await checkGlobalGuardian();
  if (capReached) return { status: 'SHUTDOWN', message: 'Global Budget Cap Reached' };

  // ── CART RECOVERY PRIORITY (RESCUE MODE) ──
  try {
    const summary = await metaService.getSummary();
    const remainingBudget = GLOBAL_BUDGET_CAP - summary.total_spend_10d;
    
    if (summary.total_atc_value > 100000 && remainingBudget > 1000) {
      logger.info(`High ATC Value detected (₹${summary.total_atc_value}). Prioritizing Retargeting.`);
      const allCamps = await metaService.getCampaigns();
      const retargeting = allCamps.find(c => c.name.includes('RETARGETING'));
      
      if (retargeting && retargeting.status !== 'ACTIVE') {
        await metaService.scaleBudget(retargeting.id, 50000, 'Activating Retargeting for Cart Recovery');
        await pushAlert('INFO', `Guardian: Activated Retargeting campaign to capture ₹${summary.total_atc_value} in carts.`);
      }
    }
  } catch (err) {
    logger.error('Cart Recovery activation failed', { error: err.message });
  }

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
