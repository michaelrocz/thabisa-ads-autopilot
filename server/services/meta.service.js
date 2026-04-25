// ============================================================
// THABISA ADS AUTOPILOT — META MARKETING API SERVICE
// ============================================================
const axios = require('axios');
const { AsyncLocalStorage } = require('async_hooks');
const logger = require('../utils/logger');

const metaTokenStorage = new AsyncLocalStorage();

const BASE_URL = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`;
const ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_2285838831476206'; 
const PIXEL_ID = '1541255577299707';
const DRY_RUN = process.env.DRY_RUN !== 'false';

// ── HELPERS ─────────────────────────────────────────────────
function getToken() {
  return metaTokenStorage.getStore() || process.env.META_ACCESS_TOKEN;
}

function api(endpoint, params = {}) {
  return axios.get(`${BASE_URL}${endpoint}`, {
    params: { access_token: getToken(), ...params }
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
    params: { access_token: getToken(), ...data }
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
  const [campaigns, insightsMonth, insights30d] = await Promise.all([
    getCampaigns(),
    getInsights('this_month', 'campaign'),
    getInsights('last_30d', 'campaign')
  ]);

  const totalSpendMonth = insightsMonth.reduce((s, r) => s + parseFloat(r.spend), 0);
  const totalRevenueMonth = insightsMonth.reduce((s, r) => s + parseFloat(r.purchase_value), 0);
  const blendedRoasMonth = totalSpendMonth > 0 ? (totalRevenueMonth / totalSpendMonth) : 0;
  const totalPurchasesMonth = insightsMonth.reduce((s, r) => s + r.purchases, 0);
  const avgCppMonth = totalPurchasesMonth > 0 ? totalSpendMonth / totalPurchasesMonth : null;
  const avgFrequency = insightsMonth.reduce((s, r) => s + r.frequency, 0) / (insightsMonth.length || 1);

  const flagged = insightsMonth.filter(r => r.flags.length > 0);
  const healthy = insightsMonth.filter(r => r.health_status === 'HEALTHY').length;
  const critical = insightsMonth.filter(r => r.health_status === 'CRITICAL').length;

  return {
    platform: 'meta',
    account_id: ACCOUNT_ID,
    currency: process.env.CURRENCY || 'INR',
    period: 'this_month',
    total_spend: parseFloat(totalSpendMonth.toFixed(2)),
    total_revenue: parseFloat(totalRevenueMonth.toFixed(2)),
    blended_roas: parseFloat(blendedRoasMonth.toFixed(2)),
    total_purchases: totalPurchasesMonth,
    avg_cpp: avgCppMonth ? parseFloat(avgCppMonth.toFixed(2)) : null,
    avg_frequency: parseFloat(avgFrequency.toFixed(2)),
    active_campaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
    total_campaigns: campaigns.length,
    health: { healthy, critical, watch: insightsMonth.length - healthy - critical },
    flagged_count: flagged.length,
    flagged,
    campaigns_detail: insightsMonth.map(row => {
      const campaign = campaigns.find(c => c.id === row.campaign_id);
      return {
        ...row,
        status: campaign ? campaign.status : 'UNKNOWN',
        daily_budget: campaign ? (parseFloat(campaign.daily_budget || campaign.lifetime_budget || 0) / 100) : 0
      };
    })
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

async function decreaseBudget(campaignId, currentBudget, reason) {
  const newBudget = Math.max(500, Math.round(currentBudget * 0.90)); // -10%, min 500
  logger.logAction({
    platform: 'META', objectId: campaignId, action: 'DECREASE_BUDGET',
    reason, oldValue: currentBudget, newValue: newBudget
  });
  if (DRY_RUN) return { dry_run: true, action: 'DECREASE_BUDGET', id: campaignId, old: currentBudget, new: newBudget };
  return apiPost(`/${campaignId}`, { daily_budget: newBudget });
}

async function updateAdSetTargeting(adSetId, targeting) {
  logger.logAction({
    platform: 'META', objectId: adSetId, action: 'UPDATE_TARGETING',
    reason: 'Audience optimization', newValue: targeting
  });
  if (DRY_RUN) return { dry_run: true, action: 'UPDATE_TARGETING', id: adSetId };
  return apiPost(`/${adSetId}`, { targeting: JSON.stringify(targeting) });
}

async function updateStatus(objectId, status) {
  logger.logAction({
    platform: 'META', objectId, action: 'UPDATE_STATUS',
    reason: 'Manual activation/pause', newValue: status
  });
  if (DRY_RUN) return { dry_run: true, action: 'UPDATE_STATUS', id: objectId, status };
  return apiPost(`/${objectId}`, { status });
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

async function getLibraryAssets() {
  const [images, videos] = await Promise.all([
    api(`/${ACCOUNT_ID}/adimages`, { fields: 'hash,name,url', limit: 50 }),
    api(`/${ACCOUNT_ID}/advideos`, { fields: 'id,title,thumbnail_url', limit: 50 })
  ]);
  
  return {
    images: images.data || [],
    videos: videos.data || []
  };
}

module.exports = {
  testConnection, getCampaigns, getAdSets, getInsights,
  getSummary, pauseAdSet, scaleBudget, decreaseBudget, 
  updateAdSetTargeting, updateStatus, pauseAd, getPixelHealth,
  getLibraryAssets, getToken,
  metaTokenStorage
};
