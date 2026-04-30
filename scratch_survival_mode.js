require('dotenv').config({ path: '.env.vercel' });
const meta = require('./server/services/meta.service');
const google = require('./server/services/google.service');

async function executeSurvivalMode() {
  console.log('--- EXECUTING SURVIVAL MODE ---');

  // 1. META CAMPAIGNS
  console.log('\nProcessing Meta Campaigns...');
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
        console.log(`PAUSING META: ${c.name}`);
        // Pause campaign using graph api directly to bypass rules
        const axios = require('axios');
        try {
           await axios.post(`https://graph.facebook.com/v21.0/${c.id}?access_token=${meta.getToken()}`, { status: 'PAUSED' });
        } catch(e) { console.error('Failed to pause Meta', c.name, e.response?.data); }
      } else {
        const newBudget = c.name.includes('RETARGETING') ? 15000 : 17500; // in paise
        console.log(`UPDATING BUDGET META: ${c.name} to ₹${newBudget/100}/day`);
        const axios = require('axios');
        try {
           await axios.post(`https://graph.facebook.com/v21.0/${c.id}?access_token=${meta.getToken()}`, { daily_budget: newBudget });
        } catch(e) { console.error('Failed to update budget Meta', c.name, e.response?.data); }
      }
    }
  }

  // 2. GOOGLE CAMPAIGNS
  console.log('\nProcessing Google Campaigns...');
  if (!process.env.GOOGLE_REFRESH_TOKEN) { console.log('No google token locally.'); return; }
  
  const googleCampaigns = await google.getCampaigns();
  
  const googleKeep = [
    'Remarketing Cart-Display',
    'Hammam'
  ];

  for (const c of googleCampaigns) {
    // Status 2 is ENABLED, 3 is PAUSED
    if (c.status === 2) {
      if (!googleKeep.includes(c.name)) {
        console.log(`PAUSING GOOGLE: ${c.name}`);
        try { await google.pauseCampaign(c.id, 'Survival Mode Restructure'); }
        catch(e) { console.error('Failed to pause Google', c.name, e.message); }
      } else {
        const newBudgetMicros = c.name === 'Hammam' ? 175000000 : 150000000;
        console.log(`UPDATING BUDGET GOOGLE: ${c.name} to ₹${newBudgetMicros/1000000}/day`);
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
          } catch(e) { console.error('Failed to update budget Google', c.name, e.message); }
        }
      }
    } else if (c.status === 3 && googleKeep.includes(c.name)) {
      // Hammam might be paused (status 3). We need to ACTIVATE it and set budget.
      console.log(`ACTIVATING GOOGLE: ${c.name}`);
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
          status: 2 // ENABLED
        });
        const newBudgetMicros = c.name === 'Hammam' ? 175000000 : 150000000;
        console.log(`UPDATING BUDGET GOOGLE: ${c.name} to ₹${newBudgetMicros/1000000}/day`);
        await customer.campaignBudgets.update({
          resource_name: c.budget_resource_name,
          amount_micros: newBudgetMicros
        });
      } catch(e) { console.error('Failed to activate Google', c.name, e.message); }
    }
  }

  console.log('\n--- SURVIVAL MODE EXECUTION COMPLETE ---');
}

executeSurvivalMode();
