require('dotenv').config();
const ms = require('./server/services/meta.service');

async function createRetargeting() {
  try {
    const accountId = process.env.META_AD_ACCOUNT_ID;
    const pixelId = '2089219804702392';
    const audienceId = '120243685473210559';
    const campaignId = '120243685481730559'; // Campaign already created
    
    // 3. Create Ad Set
    console.log('Creating Ad Set...');
    const adSet = await ms.apiPost(`/${accountId}/adsets`, {
      name: 'Retargeting - All Visitors 30D',
      campaign_id: campaignId,
      status: 'PAUSED',
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      targeting: JSON.stringify({
        geo_locations: { countries: ['IN'] },
        custom_audiences: [{ id: audienceId }]
      }),
      promoted_object: { pixel_id: pixelId, custom_event_type: 'PURCHASE' }
    });
    
    console.log('Ad Set created:', JSON.stringify(adSet));
    
    return { campaign_id: campaignId, adset_id: adSet.id, audience_id: audienceId };
  } catch (e) {
    console.error(e);
  }
}

createRetargeting();
