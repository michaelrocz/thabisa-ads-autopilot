// ============================================================
// THABISA ADS AUTOPILOT — GOOGLE ADS API SERVICE
// ============================================================
const { GoogleAdsApi } = require('google-ads-api');
const logger = require('../utils/logger');

const DRY_RUN = process.env.DRY_RUN !== 'false';

function getClient() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_DEVELOPER_TOKEN'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Google Ads not configured. Missing: ${missing.join(', ')}. Visit http://localhost:3001/auth/google`);

  return new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_DEVELOPER_TOKEN,
  });
}

function getCustomer() {
  const client = getClient();
  if (!process.env.GOOGLE_CUSTOMER_ID) throw new Error('GOOGLE_CUSTOMER_ID not set in .env');
  return client.Customer({
    customer_id: process.env.GOOGLE_CUSTOMER_ID.replace(/-/g, ''),
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

// ── CONNECTION TEST ─────────────────────────────────────────
async function testConnection() {
  const customer = getCustomer();
  const result = await customer.query(`
    SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.status
    FROM customer LIMIT 1
  `);
  const c = result[0]?.customer;
  return { ok: true, customer_id: c?.id, name: c?.descriptive_name, currency: c?.currency_code, status: c?.status };
}

// ── CAMPAIGNS ───────────────────────────────────────────────
async function getCampaigns() {
  const customer = getCustomer();
  const rows = await customer.query(`
    SELECT
      campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
      campaign.target_roas.target_roas, campaign.bidding_strategy_type,
      campaign_budget.amount_micros, campaign_budget.period
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `);
  return rows.map(r => ({
    id: r.campaign.id,
    name: r.campaign.name,
    status: r.campaign.status,
    type: r.campaign.advertising_channel_type,
    bid_strategy: r.campaign.bidding_strategy_type,
    target_roas: r.campaign.target_roas?.target_roas || null,
    daily_budget_micros: r.campaign_budget?.amount_micros || 0,
    daily_budget_inr: ((r.campaign_budget?.amount_micros || 0) / 1e6).toFixed(2),
  }));
}

// ── METRICS ─────────────────────────────────────────────────
async function getCampaignMetrics(dateRange = 'LAST_7_DAYS') {
  const customer = getCustomer();
  const rows = await customer.query(`
    SELECT
      campaign.id, campaign.name, campaign.status,
      metrics.impressions, metrics.clicks, metrics.ctr,
      metrics.average_cpc, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value,
      metrics.cost_per_conversion, metrics.search_impression_share,
      metrics.all_conversions_value, metrics.all_conversions
    FROM campaign
    WHERE segments.date DURING ${dateRange}
      AND campaign.status != 'REMOVED'
      AND metrics.impressions > 0
    ORDER BY metrics.cost_micros DESC
  `);

  const targetRoas = parseFloat(process.env.TARGET_ROAS || 3);
  const targetCpp = parseFloat(process.env.TARGET_CPP || 2500);

  return rows.map(r => {
    const spend = (r.metrics.cost_micros || 0) / 1e6;
    const convValue = r.metrics.conversions_value || 0;
    const conversions = r.metrics.conversions || 0;
    const roas = spend > 0 ? convValue / spend : 0;
    const cpp = conversions > 0 ? spend / conversions : null;
    const impressionShare = r.metrics.search_impression_share || null;

    let healthStatus = 'WATCH';
    if (roas >= targetRoas) healthStatus = 'HEALTHY';
    else if (roas < 1.5) healthStatus = 'CRITICAL';

    const flags = [];
    if (cpp && cpp > targetCpp * 2) flags.push('CPP_CRITICAL');
    if (impressionShare && impressionShare < 0.5 && roas >= targetRoas) flags.push('LOW_IMPRESSION_SHARE');
    if (r.metrics.ctr < 0.008) flags.push('LOW_CTR');

    return {
      campaign_id: r.campaign.id,
      campaign_name: r.campaign.name,
      status: r.campaign.status,
      spend: parseFloat(spend.toFixed(2)),
      impressions: r.metrics.impressions || 0,
      clicks: r.metrics.clicks || 0,
      ctr: parseFloat(((r.metrics.ctr || 0) * 100).toFixed(2)),
      avg_cpc: parseFloat(((r.metrics.average_cpc || 0) / 1e6).toFixed(2)),
      conversions: parseFloat((conversions).toFixed(1)),
      conversion_value: parseFloat(convValue.toFixed(2)),
      roas: parseFloat(roas.toFixed(2)),
      cpp: cpp ? parseFloat(cpp.toFixed(2)) : null,
      impression_share: impressionShare ? parseFloat((impressionShare * 100).toFixed(1)) : null,
      health_status: healthStatus,
      flags
    };
  });
}

// ── SUMMARY ─────────────────────────────────────────────────
async function getSummary() {
  const [campaigns, metrics] = await Promise.all([
    getCampaigns(),
    getCampaignMetrics('LAST_7_DAYS')
  ]);

  const totalSpend = metrics.reduce((s, r) => s + r.spend, 0);
  const totalRevenue = metrics.reduce((s, r) => s + r.conversion_value, 0);
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const totalConversions = metrics.reduce((s, r) => s + r.conversions, 0);
  const avgCpp = totalConversions > 0 ? totalSpend / totalConversions : null;

  const healthy = metrics.filter(r => r.health_status === 'HEALTHY').length;
  const critical = metrics.filter(r => r.health_status === 'CRITICAL').length;
  const flagged = metrics.filter(r => r.flags.length > 0);

  return {
    platform: 'google',
    currency: process.env.CURRENCY || 'INR',
    period: 'last_7d',
    total_spend: parseFloat(totalSpend.toFixed(2)),
    total_revenue: parseFloat(totalRevenue.toFixed(2)),
    blended_roas: parseFloat(blendedRoas.toFixed(2)),
    total_conversions: parseFloat(totalConversions.toFixed(1)),
    avg_cpp: avgCpp ? parseFloat(avgCpp.toFixed(2)) : null,
    active_campaigns: campaigns.filter(c => c.status === 'ENABLED').length,
    total_campaigns: campaigns.length,
    health: { healthy, critical, watch: metrics.length - healthy - critical },
    flagged_count: flagged.length,
    flagged,
    campaigns_detail: metrics
  };
}

// ── ACTIONS ─────────────────────────────────────────────────
async function updateTargetRoas(campaignId, currentRoas, newRoas, reason) {
  logger.logAction({
    platform: 'GOOGLE', objectId: campaignId, action: 'UPDATE_TARGET_ROAS',
    reason, oldValue: currentRoas, newValue: newRoas
  });
  if (DRY_RUN) return { dry_run: true, action: 'UPDATE_TARGET_ROAS', id: campaignId, old: currentRoas, new: newRoas };
  const customer = getCustomer();
  // Google Ads mutation via GAQL — update campaign target ROAS
  const campaign = { resource_name: `customers/${process.env.GOOGLE_CUSTOMER_ID}/campaigns/${campaignId}`, target_roas: { target_roas: newRoas } };
  return customer.campaigns.update([campaign]);
}

async function pauseCampaign(campaignId, reason) {
  logger.logAction({
    platform: 'GOOGLE', objectId: campaignId, action: 'PAUSE_CAMPAIGN',
    reason, oldValue: 'ENABLED', newValue: 'PAUSED'
  });
  if (DRY_RUN) return { dry_run: true, action: 'PAUSE_CAMPAIGN', id: campaignId };
  const customer = getCustomer();
  const campaign = { resource_name: `customers/${process.env.GOOGLE_CUSTOMER_ID}/campaigns/${campaignId}`, status: 3 }; // 3 = PAUSED
  return customer.campaigns.update([campaign]);
}

async function updateCampaignBudget(budgetResourceName, currentMicros, reason) {
  const pct = currentMicros < 500000000 ? 0.20 : 0.15; // < ₹500 → +20%, else +15%
  const newMicros = Math.round(currentMicros * (1 + pct));
  logger.logAction({
    platform: 'GOOGLE', objectId: budgetResourceName, action: 'SCALE_BUDGET',
    reason, oldValue: currentMicros / 1e6, newValue: newMicros / 1e6
  });
  if (DRY_RUN) return { dry_run: true, action: 'SCALE_BUDGET', old_inr: currentMicros / 1e6, new_inr: newMicros / 1e6 };
  const customer = getCustomer();
  const budget = { resource_name: budgetResourceName, amount_micros: newMicros };
  return customer.campaignBudgets.update([budget]);
}

module.exports = {
  testConnection, getCampaigns, getCampaignMetrics,
  getSummary, updateTargetRoas, pauseCampaign, updateCampaignBudget
};
