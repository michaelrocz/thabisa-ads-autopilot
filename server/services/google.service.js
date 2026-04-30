// ============================================================
// THABISA ADS AUTOPILOT — GOOGLE ADS API SERVICE
// ============================================================
const logger = require('../utils/logger');

const DRY_RUN = process.env.DRY_RUN !== 'false';

function getClient() {
  const { GoogleAdsApi } = require('google-ads-api');
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

// ── HELPERS ─────────────────────────────────────────────────
async function runQuery(customer, query) {
  try {
    return await customer.query(query);
  } catch (e) {
    logger.error(`Google Ads Query Error: ${e.message}`, { query, error: e });
    throw e;
  }
}

// ── CAMPAIGNS ───────────────────────────────────────────────
async function getCampaigns() {
  const customer = getCustomer();
  const rows = await runQuery(customer, `
    SELECT
      campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
      campaign.target_roas.target_roas, campaign.bidding_strategy_type,
      campaign_budget.amount_micros, campaign_budget.period, campaign_budget.resource_name
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `);
  return rows.map(r => ({
    id: String(r.campaign.id),
    name: r.campaign.name,
    status: r.campaign.status,
    type: r.campaign.advertising_channel_type,
    bid_strategy: r.campaign.bidding_strategy_type,
    target_roas: r.campaign.target_roas?.target_roas || null,
    daily_budget_micros: r.campaign_budget?.amount_micros || 0,
    daily_budget_inr: ((r.campaign_budget?.amount_micros || 0) / 1e6).toFixed(2),
    budget_resource_name: r.campaign_budget?.resource_name
  }));
}

// ── METRICS ─────────────────────────────────────────────────
async function getCampaignMetrics(dateRange = 'LAST_7_DAYS') {
  const customer = getCustomer();
  const rows = await runQuery(customer, `
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
      campaign_id: String(r.campaign.id),
      campaign_name: r.campaign.name,
      status: r.campaign.status,
      spend: parseFloat(spend.toFixed(2)),
      impressions: parseInt(r.metrics.impressions || 0),
      clicks: parseInt(r.metrics.clicks || 0),
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
  const campaigns = await getCampaigns();
  const [metrics, metricsToday] = await Promise.all([
    getCampaignMetrics('THIS_MONTH'),
    getCampaignMetrics('TODAY').catch(() => [])
  ]);

  const totalSpend = metrics.reduce((s, r) => s + r.spend, 0);
  const totalRevenue = metrics.reduce((s, r) => s + r.conversion_value, 0);
  const totalSpendToday = metricsToday.reduce((s, r) => s + r.spend, 0);
  
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const totalConversions = metrics.reduce((s, r) => s + r.conversions, 0);
  const avgCpp = totalConversions > 0 ? totalSpend / totalConversions : null;

  const healthy = metrics.filter(r => r.health_status === 'HEALTHY').length;
  const critical = metrics.filter(r => r.health_status === 'CRITICAL').length;
  const flagged = metrics.filter(r => r.flags.length > 0);

  return {
    platform: 'google',
    currency: process.env.CURRENCY || 'INR',
    period: 'this_month',
    total_spend: parseFloat(totalSpend.toFixed(2)),
    total_spend_today: parseFloat(totalSpendToday.toFixed(2)),
    total_revenue: parseFloat(totalRevenue.toFixed(2)),
    blended_roas: parseFloat(blendedRoas.toFixed(2)),
    total_conversions: parseFloat(totalConversions.toFixed(1)),
    avg_cpp: avgCpp ? parseFloat(avgCpp.toFixed(2)) : null,
    active_campaigns: campaigns.filter(c => c.status === 2 || c.status === 'ENABLED').length,
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
  if (DRY_RUN) return { dry_run: true, action: 'UPDATE_TARGET_ROAS', old: currentRoas, new: newRoas };
  const cleanId = process.env.GOOGLE_CUSTOMER_ID.replace(/-/g, '');
  const customer = getCustomer();
  const campaign = { resource_name: `customers/${cleanId}/campaigns/${campaignId}`, target_roas: { target_roas: newRoas } };
  await customer.campaigns.update([campaign]);
  return { ok: true, campaign_id: campaignId, new_target_roas: newRoas };
}

async function enableCampaign(campaignId, reason) {
  logger.logAction({
    platform: 'GOOGLE', objectId: campaignId, action: 'ENABLE_CAMPAIGN',
    reason, oldValue: 'PAUSED', newValue: 'ENABLED'
  });
  if (DRY_RUN) return { dry_run: true, action: 'ENABLE_CAMPAIGN', id: campaignId };
  const customer = getCustomer();
  const cleanId = process.env.GOOGLE_CUSTOMER_ID.replace(/-/g, '');
  const campaign = { resource_name: `customers/${cleanId}/campaigns/${campaignId}`, status: 2 }; // 2 = ENABLED
  await customer.campaigns.update([campaign]);
  return { ok: true, campaign_id: campaignId, status: 'ENABLED' };
}

async function pauseCampaign(campaignId, reason) {
  logger.logAction({
    platform: 'GOOGLE', objectId: campaignId, action: 'PAUSE_CAMPAIGN',
    reason, oldValue: 'ENABLED', newValue: 'PAUSED'
  });
  if (DRY_RUN) return { dry_run: true, action: 'PAUSE_CAMPAIGN', id: campaignId };
  const customer = getCustomer();
  const cleanId = process.env.GOOGLE_CUSTOMER_ID.replace(/-/g, '');
  const campaign = { resource_name: `customers/${cleanId}/campaigns/${campaignId}`, status: 3 }; // 3 = PAUSED
  await customer.campaigns.update([campaign]);
  return { ok: true, campaign_id: campaignId, status: 'PAUSED' };
}

async function scaleBudget(campaignId, budgetResourceName, currentMicros, reason) {
  const targetCpp = parseFloat(process.env.TARGET_CPP || 2500);
  const currentInr = currentMicros / 1e6;
  const pct = currentInr < targetCpp * 5 ? 0.20 : 0.15; 
  const newMicros = Math.round(currentMicros * (1 + pct));
  
  logger.logAction({
    platform: 'GOOGLE', objectId: campaignId, action: 'SCALE_BUDGET',
    reason, oldValue: currentInr, newValue: newMicros / 1e6
  });
  
  if (DRY_RUN) return { dry_run: true, action: 'SCALE_BUDGET', old_inr: currentInr, new_inr: newMicros / 1e6 };
  const customer = getCustomer();
  const budget = { resource_name: budgetResourceName, amount_micros: newMicros };
  await customer.campaignBudgets.update([budget]);
  return { ok: true, campaign_id: campaignId, new_budget_inr: newMicros / 1e6 };
}

async function decreaseBudget(campaignId, budgetResourceName, currentMicros, reason) {
  const currentInr = currentMicros / 1e6;
  const newMicros = Math.max(500 * 1e6, Math.round(currentMicros * 0.90)); // -10%, min ₹500
  
  logger.logAction({
    platform: 'GOOGLE', objectId: campaignId, action: 'DECREASE_BUDGET',
    reason, oldValue: currentInr, newValue: newMicros / 1e6
  });
  
  if (DRY_RUN) return { dry_run: true, action: 'DECREASE_BUDGET', old_inr: currentInr, new_inr: newMicros / 1e6 };
  const customer = getCustomer();
  const budget = { resource_name: budgetResourceName, amount_micros: newMicros };
  await customer.campaignBudgets.update([budget]);
  return { ok: true, campaign_id: campaignId, new_budget_inr: newMicros / 1e6 };
}

async function createSearchCampaign(name, dailyBudgetInr, keywords) {
  const customer = getCustomer();
  const { enums } = require('google-ads-api');

  logger.info(`Creating Search Campaign: ${name}`);
  
  try {
    // 1. Create Campaign Budget
    const budget = {
      name: `${name} Budget`,
      amount_micros: Math.round(dailyBudgetInr * 1e6),
      delivery_method: 2, // STANDARD
      explicitly_shared: false
    };
    const budgetOp = await customer.campaignBudgets.create([budget]);
    const budgetResourceName = typeof budgetOp[0] === 'string' ? budgetOp[0] : (budgetOp.results ? budgetOp.results[0] : budgetOp[0]);
    const finalBudgetName = typeof budgetResourceName === 'object' ? budgetResourceName.resource_name : budgetResourceName;

    // 2. Create Campaign
    const campaign = {
      name: name,
      advertising_channel_type: 2, // SEARCH
      status: 3, // PAUSED (Safety first)
      manual_cpc: {}, // ECPC not allowed in this context
      campaign_budget: finalBudgetName,
      contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
      network_settings: {
        target_google_search: true,
        target_search_network: true,
        target_content_network: false,
        target_partner_search_network: false
      }
    };
    const campaignOp = await customer.campaigns.create([campaign]);
    const campaignRes = typeof campaignOp[0] === 'string' ? campaignOp[0] : (campaignOp.results ? campaignOp.results[0] : campaignOp[0]);
    const finalCampaignName = typeof campaignRes === 'object' ? campaignRes.resource_name : campaignRes;
    const campaignId = finalCampaignName.split('/').pop();

    // 3. Create Ad Group
    const adGroup = {
      name: 'Main Ad Group',
      campaign: finalCampaignName,
      status: 2, // ENABLED
      type: 2, // SEARCH_STANDARD
      cpc_bid_micros: 20 * 1e6 // Initial ₹20 bid
    };
    const adGroupOp = await customer.adGroups.create([adGroup]);
    const adGroupRes = typeof adGroupOp[0] === 'string' ? adGroupOp[0] : (adGroupOp.results ? adGroupOp.results[0] : adGroupOp[0]);
    const finalAdGroupName = typeof adGroupRes === 'object' ? adGroupRes.resource_name : adGroupRes;

    // 4. Add Keywords
    const keywordOps = keywords.map(k => ({
      ad_group: finalAdGroupName,
      status: 2, // ENABLED
      keyword: {
        text: k,
        match_type: 2 // BROAD (Google recommended for ML, or 3=PHRASE)
      }
    }));
    await customer.adGroupCriteria.create(keywordOps);

    // 5. Create Responsive Search Ad
    const ad = {
      ad_group: finalAdGroupName,
      ad: {
        final_urls: ['https://thabisa.shop/'],
        responsive_search_ad: {
          headlines: [
            { text: 'Thabisa: Joyful Home Living' },
            { text: 'Premium Acrylic Coated Aprons' },
            { text: 'Oekotex Certified Baby Gear' },
            { text: 'Durable & Aesthetic Pet Beds' },
            { text: 'Shop Unique Boutique Decor' }
          ],
          descriptions: [
            { text: 'High-utility minimalist home textiles, bags, and kids products designed to bring joy.' },
            { text: 'Slow living essentials. Ethical, safe, and Oekotex approved. Shop the Thabisa collection.' }
          ]
        }
      },
      status: 2 // ENABLED
    };
    await customer.adGroupAds.create([ad]);

    return { ok: true, campaign_id: campaignId, campaign_name: name };
  } catch (err) {
    logger.error(`Google Ads Create Campaign Error: ${err.message}`, { error: err });
    throw err;
  }
}

module.exports = {
  testConnection, getCampaigns, getCampaignMetrics,
  getSummary, updateTargetRoas, pauseCampaign, enableCampaign,
  scaleBudget, decreaseBudget, getCustomer,
  createSearchCampaign
};
