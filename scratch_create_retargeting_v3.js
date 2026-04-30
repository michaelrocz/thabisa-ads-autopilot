require('dotenv').config();
const ms = require('./server/services/meta.service');

async function createRetargeting() {
  try {
    const accountId = process.env.META_AD_ACCOUNT_ID;
    
    // 1. Create Custom Audience: Website Visitors 30D
    console.log('Creating Custom Audience...');
    // Modern Structure for Website Custom Audience
    const audience = await ms.apiPost(`/${accountId}/customaudiences`, {
      name: 'Autopilot Retargeting - Website Visitors 30D',
      description: 'People who visited the website in the last 30 days',
      pixel_id: '2089219804702392',
      subtype: 'WEBSITE',
      rule: JSON.stringify({
        inclusions: {
          operator: "or",
          rules: [
            {
              event_name: "PageView",
              retention_seconds: 30 * 24 * 3600
            }
          ]
        }
      }),
      prefill: 1
    });
    
    console.log('Audience created:', JSON.stringify(audience));
    
    // 2. Create Retargeting Campaign
    console.log('Creating Retargeting Campaign...');
    const campaign = await ms.apiPost(`/${accountId}/campaigns`, {
      name: 'AUTOPILOT_RETARGETING_2026-04-29',
      objective: 'OUTCOME_SALES',
      status: 'PAUSED'
    });
    
    console.log('Campaign created:', JSON.stringify(campaign));
    
    // 3. Create Ad Set
    console.log('Creating Ad Set...');
    const adSet = await ms.apiPost(`/${accountId}/adsets`, {
      name: 'Retargeting - All Visitors 30D',
      campaign_id: campaign.id,
      status: 'PAUSED',
      daily_budget: 500 * 100, 
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      targeting: JSON.stringify({
        geo_locations: { countries: ['IN'] },
        custom_audiences: [{ id: audience.id }]
      }),
      promoted_object: { pixel_id: '2089219804702392', custom_event_type: 'PURCHASE' }
    });
    
    console.log('Ad Set created:', JSON.stringify(adSet));
    
    return { campaign_id: campaign.id, adset_id: adSet.id, audience_id: audience.id };
  } catch (e) {
    console.error(e);
  }
}

createRetargeting();
