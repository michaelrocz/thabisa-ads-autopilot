// ============================================================
// THABISA ADS AUTOPILOT — META MARKETING API SERVICE
// ============================================================
const axios = require('axios');
const logger = require('../utils/logger');

const BASE_URL = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`;
const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID; // act_XXXXXXXX
const DRY_RUN = process.env.DRY_RUN !== 'false';

// ── HELPERS ─────────────────────────────────────────────────
function api(endpoint, params = {}) {
  return axios.get(`${BASE_URL}${endpoint}`, {
    params: { access_token: TOKEN, ...params }
  }).then(r => r.data).catch(err => {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error(`Meta API error: ${msg}`, { endpoint });
    throw new Error(`Meta API: ${msg}`);
  });
}

function apiPost(endpoint, data = {}) {
  if (DRY_RUN) {
    logger.info(`[DRY RUN] POST ${endpoint}`, data);
    return Promise.resolve({ id: 'dry_run', dry_run: true });
  }
  return axios.post(`${BASE_URL}${endpoint}`, null, {
    params: { access_token: TOKEN, ...data }
  }).then(r => r.data).catch(err => {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error(`Meta API POST error: ${msg}`, { endpoint });
    throw new Error(`Meta API: ${msg}`);
  });
}

// ── CONNECTION TEST ─────────────────────────────────────────
async function testConnection() {
  const data = await api(`/${ACCOUNT_ID}`, { fields: 'id,name,currency,account_status' });
  return {
    ok: true,
    account_id: data.id,
    account_name: data.name,
    currency: data.currency,
    status: data.account_status === 1 ? 'ACTIVE' : data.account_status
  };
}

// ── CAMPAIGNS ───────────────────────────────────────────────
async function getCampaigns() {
  const data = await api(`/${ACCOUNT_ID}/campaigns`, {
    fields: 'id,name,status,objective,daily_budget,lifetime_budget,budget_remaining',
    limit: 100
  });
  return data.data || [];
}

// ── AD SETS ─────────────────────────────────────────────────
async function getAdSets(campaignId = null) {
  const endpoint = campaignId
    ? `/${campaignId}/adsets`
    : `/${ACCOUNT_ID}/adsets`;
  const data = await api(endpoint, {
    fields: 'id,name,status,campaign_id,daily_budget,bid_strategy,targeting,frequency_cap',
    limit: 200
  });
  return data.data || [];
}

// ── INSIGHTS (PERFORMANCE METRICS) ──────────────────────────
async function getInsights(datePreset = 'last_7d', level = 'campaign') {
  const data = await api(`/${ACCOUNT_ID}/insights`, {
    date_preset: datePreset,
    level,
    fields: [
      'campaign_id', 'campaign_name', 'adset_id', 'adset_name',
      'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'spend', 'reach', 'frequency',
      'actions', 'action_values', 'cost_per_action_type'
    ].join(','),
    limit: 200
  });
  return (data.data || []).map(row => enrichInsightRow(row));
}

function enrichInsightRow(row) {
  const spend = parseFloat(row.spend || 0);
  const purchaseValue = getPurchaseValue(row.action_values);
  const purchases = getPurchaseCount(row.actions);
  const roas = spend > 0 ? purchaseValue / spend : 0;
  const cpp = purchases > 0 ? spend / purchases : null;
  const ctr = parseFloat(row.ctr || 0);
  const frequency = parseFloat(row.frequency || 0);

  let healthStatus = 'WATCH';
  if (roas >= parseFloat(process.env.TARGET_ROAS || 3)) healthStatus = 'HEALTHY';
  else if (roas < 1.5) healthStatus = 'CRITICAL';

  const flags = [];
  if (ctr < 0.8) flags.push('CREATIVE_FATIGUE');
  if (frequency > 3.5) flags.push('AUDIENCE_BURN');
  const targetCpp = parseFloat(process.env.TARGET_CPP || 2500);
  if (cpp && cpp > targetCpp * 2) flags.push('CPP_CRITICAL');

  return {
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    adset_id: row.adset_id,
    adset_name: row.adset_name,
    spend: spend.toFixed(2),
    impressions: parseInt(row.impressions || 0),
    clicks: parseInt(row.clicks || 0),
    ctr: parseFloat(ctr.toFixed(2)),
    cpc: parseFloat(row.cpc || 0).toFixed(2),
    cpm: parseFloat(row.cpm || 0).toFixed(2),
    frequency: parseFloat(frequency.toFixed(2)),
    reach: parseInt(row.reach || 0),
    purchases,
    purchase_value: purchaseValue.toFixed(2),
    roas: parseFloat(roas.toFixed(2)),
    cpp: cpp ? parseFloat(cpp.toFixed(2)) : null,
    health_status: healthStatus,
    flags
  };
}

function getPurchaseValue(actionValues = []) {
  if (!Array.isArray(actionValues)) return 0;
  const purchase = actionValues.find(a =>
    a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
  );
  return purchase ? parseFloat(purchase.value || 0) : 0;
}

function getPurchaseCount(actions = []) {
  if (!Array.isArray(actions)) return 0;
  const purchase = actions.find(a =>
    a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
  );
  return purchase ? parseInt(purchase.value || 0) : 0;
}

// ── SUMMARY (FOR DASHBOARD) ─────────────────────────────────
async function getSummary() {
  const [campaigns, insights7d, insights30d] = await Promise.all([
    getCampaigns(),
    getInsights('last_7d', 'campaign'),
    getInsights('last_30d', 'campaign')
  ]);

  const totalSpend7d = insights7d.reduce((s, r) => s + parseFloat(r.spend), 0);
  const totalRevenue7d = insights7d.reduce((s, r) => s + parseFloat(r.purchase_value), 0);
  const blendedRoas7d = totalSpend7d > 0 ? (totalRevenue7d / totalSpend7d) : 0;
  const totalPurchases7d = insights7d.reduce((s, r) => s + r.purchases, 0);
  const avgCpp7d = totalPurchases7d > 0 ? totalSpend7d / totalPurchases7d : null;
  const avgFrequency = insights7d.reduce((s, r) => s + r.frequency, 0) / (insights7d.length || 1);

  const flagged = insights7d.filter(r => r.flags.length > 0);
  const healthy = insights7d.filter(r => r.health_status === 'HEALTHY').length;
  const critical = insights7d.filter(r => r.health_status === 'CRITICAL').length;

  return {
    platform: 'meta',
    account_id: ACCOUNT_ID,
    currency: process.env.CURRENCY || 'INR',
    period: 'last_7d',
    total_spend: parseFloat(totalSpend7d.toFixed(2)),
    total_revenue: parseFloat(totalRevenue7d.toFixed(2)),
    blended_roas: parseFloat(blendedRoas7d.toFixed(2)),
    total_purchases: totalPurchases7d,
    avg_cpp: avgCpp7d ? parseFloat(avgCpp7d.toFixed(2)) : null,
    avg_frequency: parseFloat(avgFrequency.toFixed(2)),
    active_campaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
    total_campaigns: campaigns.length,
    health: { healthy, critical, watch: insights7d.length - healthy - critical },
    flagged_count: flagged.length,
    flagged,
    campaigns_detail: insights7d
  };
}

// ── ACTIONS ─────────────────────────────────────────────────
async function pauseAdSet(adSetId, reason) {
  logger.logAction({
    platform: 'META', objectId: adSetId, action: 'PAUSE_AD_SET',
    reason, oldValue: 'ACTIVE', newValue: 'PAUSED'
  });
  if (DRY_RUN) return { dry_run: true, action: 'PAUSE_AD_SET', id: adSetId };
  return apiPost(`/${adSetId}`, { status: 'PAUSED' });
}

async function scaleBudget(campaignId, currentBudget, reason) {
  const targetCpp = parseFloat(process.env.TARGET_CPP || 2500);
  const pct = currentBudget < targetCpp * 5 ? 0.20 : 0.15; // 20% if smaller, 15% if larger
  const newBudget = Math.round(currentBudget * (1 + pct));
  logger.logAction({
    platform: 'META', objectId: campaignId, action: 'SCALE_BUDGET',
    reason, oldValue: currentBudget, newValue: newBudget
  });
  if (DRY_RUN) return { dry_run: true, action: 'SCALE_BUDGET', id: campaignId, old: currentBudget, new: newBudget };
  return apiPost(`/${campaignId}`, { daily_budget: newBudget });
}

async function pauseAd(adId, reason) {
  logger.logAction({
    platform: 'META', objectId: adId, action: 'PAUSE_AD',
    reason, oldValue: 'ACTIVE', newValue: 'PAUSED'
  });
  if (DRY_RUN) return { dry_run: true, action: 'PAUSE_AD', id: adId };
  return apiPost(`/${adId}`, { status: 'PAUSED' });
}

// ── PIXEL HEALTH ────────────────────────────────────────────
async function getPixelHealth() {
  try {
    const pixels = await api(`/${ACCOUNT_ID}/adspixels`, {
      fields: 'id,name,last_fired_time,is_unavailable'
    });
    return pixels.data || [];
  } catch (e) {
    return [];
  }
}

module.exports = {
  testConnection, getCampaigns, getAdSets, getInsights,
  getSummary, pauseAdSet, scaleBudget, pauseAd, getPixelHealth
};
