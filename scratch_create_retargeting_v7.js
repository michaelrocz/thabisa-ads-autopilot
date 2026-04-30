require('dotenv').config();
const ms = require('./server/services/meta.service');

async function createRetargeting() {
  try {
    const accountId = process.env.META_AD_ACCOUNT_ID;
    const pixelId = '2089219804702392';
    
    // 1. Audience is already created (ID: 120243685473210559)
    const audienceId = '120243685473210559';
    console.log('Using existing Audience:', audienceId);
    
    // 2. Create Retargeting Campaign
    console.log('Creating Retargeting Campaign...');
    const campaign = await ms.apiPost(`/${accountId}/campaigns`, {
      name: 'AUTOPILOT_RETARGETING_2026-04-29',
      objective: 'OUTCOME_SALES',
      special_ad_categories: ['NONE'],
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
        custom_audiences: [{ id: audienceId }]
      }),
      promoted_object: { pixel_id: pixelId, custom_event_type: 'PURCHASE' }
    });
    
    console.log('Ad Set created:', JSON.stringify(adSet));
    
    return { campaign_id: campaign.id, adset_id: adSet.id, audience_id: audienceId };
  } catch (e) {
    console.error(e);
  }
}

createRetargeting();
