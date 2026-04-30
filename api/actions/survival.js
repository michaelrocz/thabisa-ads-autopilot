const meta = require('../../services/meta.service');
const google = require('../../services/google.service');

module.exports = async function handler(req, res) {
  try {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    log('--- EXECUTING SURVIVAL MODE ---');

    // 1. META CAMPAIGNS
    log('Processing Meta Campaigns...');
    const metaCampaigns = await meta.getCampaigns();
    
    const metaKeep = [
      'AUTOPILOT_RETARGETING_2026-04-29',
      'AUTOPILOT_SALES_Gold_Standard_Pets_Collection_2026-04-25',
      'AUTOPILOT_SALES_Gold_Standard_Table_Runners_2026-04-25',
      'AUTOPILOT_SALES_Gold_Standard_Nursing_Pillow_2026-04-25'
    ];

    for (const c of metaCampaigns) {
      if (c.status === 'ACTIVE') {
        if (!metaKeep.includes(c.name)) {
          log(`PAUSING META: ${c.name}`);
          const axios = require('axios');
          try {
             await axios.post(`https://graph.facebook.com/v21.0/${c.id}?access_token=${meta.getToken()}`, { status: 'PAUSED' });
          } catch(e) { log('Failed to pause Meta: ' + c.name); }
        } else {
          const newBudget = c.name.includes('RETARGETING') ? 15000 : 17500;
          log(`UPDATING BUDGET META: ${c.name} to ₹${newBudget/100}/day`);
          const axios = require('axios');
          try {
             await axios.post(`https://graph.facebook.com/v21.0/${c.id}?access_token=${meta.getToken()}`, { daily_budget: newBudget });
          } catch(e) { log('Failed to update budget Meta: ' + c.name); }
        }
      }
    }

    // 2. GOOGLE CAMPAIGNS
    log('\nProcessing Google Campaigns...');
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
       log('Google token not found in env.');
    } else {
      const googleCampaigns = await google.getCampaigns();
      const googleKeep = ['Remarketing Cart-Display', 'Hammam'];

      for (const c of googleCampaigns) {
        if (c.status === 2) { // ENABLED
          if (!googleKeep.includes(c.name)) {
            log(`PAUSING GOOGLE: ${c.name}`);
            try { await google.pauseCampaign(c.id, 'Survival Mode Restructure'); }
            catch(e) { log('Failed to pause Google: ' + c.name); }
          } else {
            const newBudgetMicros = c.name === 'Hammam' ? 175000000 : 150000000;
            log(`UPDATING BUDGET GOOGLE: ${c.name} to ₹${newBudgetMicros/1000000}/day`);
            if (c.budget_resource_name) {
              try {
                 const { GoogleAdsApi } = require('google-ads-api');
                 const client = new GoogleAdsApi({
                   client_id: process.env.GOOGLE_CLIENT_ID,
                   client_secret: process.env.GOOGLE_CLIENT_SECRET,
                   developer_token: process.env.GOOGLE_DEVELOPER_TOKEN
                 });
                 const customer = client.Customer({
                   customer_id: process.env.GOOGLE_CUSTOMER_ID,
                   refresh_token: process.env.GOOGLE_REFRESH_TOKEN
                 });
                 await customer.campaignBudgets.update({
                   resource_name: c.budget_resource_name,
                   amount_micros: newBudgetMicros
                 });
              } catch(e) { log('Failed to update budget Google: ' + c.name); }
            }
          }
        } else if (c.status === 3 && googleKeep.includes(c.name)) { // PAUSED
          log(`ACTIVATING GOOGLE: ${c.name}`);
          try {
            const { GoogleAdsApi } = require('google-ads-api');
            const client = new GoogleAdsApi({
              client_id: process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.GOOGLE_CLIENT_SECRET,
              developer_token: process.env.GOOGLE_DEVELOPER_TOKEN
            });
            const customer = client.Customer({
              customer_id: process.env.GOOGLE_CUSTOMER_ID,
              refresh_token: process.env.GOOGLE_REFRESH_TOKEN
            });
            await customer.campaigns.update({
              resource_name: `customers/${process.env.GOOGLE_CUSTOMER_ID}/campaigns/${c.id}`,
              status: 2
            });
            const newBudgetMicros = c.name === 'Hammam' ? 175000000 : 150000000;
            log(`UPDATING BUDGET GOOGLE: ${c.name} to ₹${newBudgetMicros/1000000}/day`);
            await customer.campaignBudgets.update({
              resource_name: c.budget_resource_name,
              amount_micros: newBudgetMicros
            });
          } catch(e) { log('Failed to activate Google: ' + c.name); }
        }
      }
    }

    log('\n--- SURVIVAL MODE EXECUTION COMPLETE ---');
    res.status(200).json({ success: true, logs });
  } catch (error) {
    console.error('Survival mode API failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
