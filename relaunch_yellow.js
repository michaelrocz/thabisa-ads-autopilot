process.env.DRY_RUN = 'false';
require('dotenv').config();
const meta = require('./server/services/meta.service');
const logger = require('./server/utils/logger');

const CAMPAIGN_ID = '120243800739070559'; // V3 Campaign
const ACCOUNT_ID = 'act_2285838831476206';
const PIXEL_ID = '2089219804702392';

// Force live execution
process.env.DRY_RUN = 'false';

async function relaunch() {
  try {
    console.log('🚀 Starting YELLOW RELAUNCH (Live)...');

    // 1. Create the Ad Set with the winning settings
    const adSet = await meta.apiPost(`/${ACCOUNT_ID}/adsets`, {
      name: `Ad Set - YELLOW RELAUNCH - ${Date.now()}`,
      campaign_id: CAMPAIGN_ID,
      optimization_goal: 'OFFSITE_CONVERSIONS',
      billing_event: 'IMPRESSIONS',
      promoted_object: JSON.stringify({
        pixel_id: PIXEL_ID,
        custom_event_type: 'PURCHASE'
      }),
      targeting: JSON.stringify({
        geo_locations: { countries: ['IN'] },
        age_min: 25,
        age_max: 65,
        targeting_automation: { advantage_audience: 1 }
      }),
      status: 'ACTIVE'
    });

    console.log(`✅ Ad Set Created: ${adSet.id}`);

    // Wait for Meta to sync
    console.log('⏳ Waiting for Meta API sync...');
    await new Promise(r => setTimeout(r, 5000));

    // 2. Clone the winning creatives
    const creatives = [
      '1438166983844869', // Yellow Hammam
      '913122394949865',  // Yellow blue sling
      '970891522025753'   // Yellow Set
    ];

    for (const cid of creatives) {
      const ad = await meta.apiPost(`/${ACCOUNT_ID}/ads`, {
        name: `YELLOW AD - ${cid}`,
        adset_id: adSet.id,
        creative: JSON.stringify({ creative_id: cid }),
        status: 'ACTIVE'
      });
      console.log(`✅ Ad Created: ${ad.id} (Creative: ${cid})`);
    }

    console.log('\n🔥 RELAUNCH COMPLETE. Ads are now LIVE and protected by Autopilot V3.');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Relaunch Failed: ${error.message}`);
    process.exit(1);
  }
}

relaunch();
