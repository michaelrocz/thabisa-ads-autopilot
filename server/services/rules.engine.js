// ============================================================
// THABISA ADS AUTOPILOT — RULES ENGINE
// All 4 trigger categories: Scale / Pause / Alert / Refresh
// ============================================================
const logger = require('../utils/logger');
const metaService = require('./meta.service');
const googleService = require('./google.service');

const TARGET_ROAS = parseFloat(process.env.TARGET_ROAS || 3.0);
const TARGET_CPP = parseFloat(process.env.TARGET_CPP || 2500);
const MIN_SPEND = parseFloat(process.env.MIN_SPEND_BEFORE_PAUSE || 1000);
const DRY_RUN = process.env.DRY_RUN !== 'false';

// In-memory history for consecutive-day ROAS tracking (reset on restart)
// In production, replace with a lightweight SQLite or file-based store
const roasHistory = {}; // { [campaignId]: [{ date, roas }] }

function recordRoas(id, roas) {
  if (!roasHistory[id]) roasHistory[id] = [];
  roasHistory[id].push({ date: new Date().toISOString().split('T')[0], roas });
  // Keep last 7 days
  if (roasHistory[id].length > 7) roasHistory[id].shift();
}

function consecutiveDaysAboveTarget(id, targetRoas, days = 3) {
  const history = roasHistory[id] || [];
  if (history.length < days) return false;
  return history.slice(-days).every(h => h.roas >= targetRoas);
}

// ── ALERT SINK ───────────────────────────────────────────────
const alerts = []; // In-memory alert queue (served via /api/actions/alerts)
function pushAlert(level, message, data = {}) {
  const alert = { level, message, data, timestamp: new Date().toISOString(), read: false };
  alerts.unshift(alert);
  if (alerts.length > 100) alerts.pop(); // keep last 100
  logger.warn(`[ALERT][${level}] ${message}`, data);
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
    pushAlert('CRITICAL', `Meta API connection failed: ${err.message}`);
    return { error: err.message, actions };
  }

  // ── PIXEL HEALTH CHECK
  const pixel = await metaService.getPixelHealth();
  if (pixel.length > 0) {
    const lastFired = pixel[0].last_fired_time;
    if (lastFired) {
      const hoursSince = (Date.now() - new Date(lastFired).getTime()) / 3600000;
      if (hoursSince > 2) {
        pushAlert('CRITICAL', `Meta Pixel not fired in ${hoursSince.toFixed(1)} hours!`, { pixel_id: pixel[0].id });
      }
    }
  }

  for (const campaign of summary.campaigns_detail) {
    recordRoas(campaign.campaign_id, campaign.roas);

    // ── SCALE TRIGGER: ROAS ≥ 3× for 3 consecutive days
    if (consecutiveDaysAboveTarget(campaign.campaign_id, TARGET_ROAS)) {
      const currentBudget = 500; // TODO: pull real budget from getCampaigns()
      logger.info(`Scale trigger: ${campaign.campaign_name} — ROAS ${campaign.roas}× for 3+ days`);
      const result = await metaService.scaleBudget(
        campaign.campaign_id, currentBudget,
        `ROAS ${campaign.roas}× ≥ ${TARGET_ROAS}× for 3 consecutive days`
      );
      actions.push({ type: 'SCALE_BUDGET', campaign: campaign.campaign_name, roas: campaign.roas, result });
    }

    // ── PAUSE TRIGGER: CPP > 2× target after min spend
    if (campaign.cpp && campaign.cpp > TARGET_CPP * 2 && parseFloat(campaign.spend) >= MIN_SPEND) {
      logger.info(`Pause trigger: ${campaign.campaign_name} — CPP ₹${campaign.cpp} > 2× target ₹${TARGET_CPP * 2}`);
      // For campaign-level: get ad sets and pause each
      const adSets = await metaService.getAdSets(campaign.campaign_id);
      for (const adSet of adSets.filter(a => a.status === 'ACTIVE')) {
        const result = await metaService.pauseAdSet(
          adSet.id,
          `CPP ₹${campaign.cpp} exceeds 2× target ₹${TARGET_CPP * 2} with spend ₹${campaign.spend} ≥ min ₹${MIN_SPEND}`
        );
        actions.push({ type: 'PAUSE_AD_SET', adset: adSet.name, cpp: campaign.cpp, result });
      }
    }

    // ── ALERT TRIGGER: ROAS drops > 40%
    const history = roasHistory[campaign.campaign_id] || [];
    if (history.length >= 2) {
      const prev = history[history.length - 2].roas;
      const curr = history[history.length - 1].roas;
      if (prev > 0 && (prev - curr) / prev > 0.4) {
        pushAlert('CRITICAL', `ROAS dropped ${(((prev - curr) / prev) * 100).toFixed(0)}% in 48h for: ${campaign.campaign_name}`, {
          campaign_id: campaign.campaign_id, previous_roas: prev, current_roas: curr
        });
      }
    }

    // ── ALERT TRIGGER: CRITICAL health
    if (campaign.health_status === 'CRITICAL') {
      pushAlert('WARNING', `Campaign CRITICAL: ${campaign.campaign_name} — ROAS ${campaign.roas}×`, {
        campaign_id: campaign.campaign_id, spend: campaign.spend, cpp: campaign.cpp
      });
    }

    // ── REFRESH TRIGGER: Frequency > 3.5
    if (campaign.frequency > 3.5) {
      pushAlert('INFO', `Creative refresh needed: ${campaign.campaign_name} — frequency ${campaign.frequency}`, {
        campaign_id: campaign.campaign_id
      });
      actions.push({ type: 'CREATIVE_REFRESH_FLAG', campaign: campaign.campaign_name, frequency: campaign.frequency });
    }

    // ── REFRESH TRIGGER: CTR < 0.8%
    if (campaign.ctr < 0.8 && campaign.frequency > 2) {
      actions.push({ type: 'CREATIVE_FATIGUE_FLAG', campaign: campaign.campaign_name, ctr: campaign.ctr, frequency: campaign.frequency });
    }
  }

  const result = {
    platform: 'META',
    timestamp: new Date().toISOString(),
    dry_run: DRY_RUN,
    summary: {
      campaigns_audited: summary.campaigns_detail.length,
      blended_roas: summary.blended_roas,
      total_spend: summary.total_spend,
      total_revenue: summary.total_revenue,
      health: summary.health
    },
    actions,
    alerts_fired: alerts.filter(a => !a.read).length
  };

  logger.info('Rules Engine: Meta audit complete', { actions_taken: actions.length });
  return result;
}

// ── GOOGLE RULES ENGINE ──────────────────────────────────────
async function runGoogleRules() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    logger.warn('Google Ads not configured — skipping Google rules');
    return { skipped: true, reason: 'Google OAuth not configured. Visit /auth/google' };
  }

  logger.info('Rules Engine: Starting Google audit...');
  const actions = [];
  let summary;

  try {
    summary = await googleService.getSummary();
  } catch (err) {
    pushAlert('CRITICAL', `Google Ads API error: ${err.message}`);
    return { error: err.message, actions };
  }

  for (const campaign of summary.campaigns_detail) {
    recordRoas(`g_${campaign.campaign_id}`, campaign.roas);

    // ── SCALE TRIGGER: Impression share < 50% and ROAS healthy
    if (campaign.impression_share !== null && campaign.impression_share < 50 && campaign.roas >= TARGET_ROAS) {
      const currentTRoas = TARGET_ROAS;
      const newTRoas = parseFloat((currentTRoas * 1.10).toFixed(2));
      logger.info(`Google Scale: ${campaign.campaign_name} — low impression share ${campaign.impression_share}% but ROAS healthy`);
      const result = await googleService.updateTargetRoas(campaign.campaign_id, currentTRoas, newTRoas,
        `Impression share ${campaign.impression_share}% < 50% and ROAS ${campaign.roas}× ≥ target`);
      actions.push({ type: 'RAISE_TROAS', campaign: campaign.campaign_name, old_troas: currentTRoas, new_troas: newTRoas, result });
    }

    // ── PAUSE TRIGGER: CPP > 2× target after min spend
    if (campaign.cpp && campaign.cpp > TARGET_CPP * 2 && campaign.spend >= MIN_SPEND) {
      const result = await googleService.pauseCampaign(campaign.campaign_id,
        `CPP ₹${campaign.cpp} > 2× target ₹${TARGET_CPP * 2} with spend ₹${campaign.spend}`);
      actions.push({ type: 'PAUSE_CAMPAIGN', campaign: campaign.campaign_name, cpp: campaign.cpp, result });
    }

    // ── ALERT TRIGGER: CRITICAL
    if (campaign.health_status === 'CRITICAL') {
      pushAlert('WARNING', `Google Campaign CRITICAL: ${campaign.campaign_name} — ROAS ${campaign.roas}×`, campaign);
    }
  }

  logger.info('Rules Engine: Google audit complete', { actions_taken: actions.length });
  return {
    platform: 'GOOGLE', timestamp: new Date().toISOString(), dry_run: DRY_RUN,
    summary: { campaigns_audited: summary.campaigns_detail.length, blended_roas: summary.blended_roas, health: summary.health },
    actions
  };
}

// ── FULL AUDIT (BOTH PLATFORMS) ──────────────────────────────
async function runFullAudit() {
  logger.info('=== THABISA AUTOPILOT: FULL AUDIT STARTING ===');
  const [metaResult, googleResult] = await Promise.allSettled([
    runMetaRules(),
    runGoogleRules()
  ]);
  const result = {
    timestamp: new Date().toISOString(),
    dry_run: DRY_RUN,
    meta: metaResult.status === 'fulfilled' ? metaResult.value : { error: metaResult.reason?.message },
    google: googleResult.status === 'fulfilled' ? googleResult.value : { error: googleResult.reason?.message }
  };
  logger.info('=== THABISA AUTOPILOT: FULL AUDIT COMPLETE ===', {
    meta_actions: result.meta?.actions?.length || 0,
    google_actions: result.google?.actions?.length || 0
  });
  return result;
}

module.exports = { runMetaRules, runGoogleRules, runFullAudit, getAlerts, markAlertsRead, pushAlert };
