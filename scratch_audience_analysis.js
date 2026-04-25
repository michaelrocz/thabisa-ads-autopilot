require('dotenv').config();
const meta = require('./server/services/meta.service');

async function run() {
  try {
    console.log('Fetching ad sets...');
    const adSets = await meta.getAdSets();
    console.log('--- AD SET TARGETING ---');
    adSets.forEach(as => {
      console.log(`\nAd Set: ${as.name} (${as.status})`);
      console.log(`Campaign ID: ${as.campaign_id}`);
      console.log(`Targeting:`, JSON.stringify(as.targeting, null, 2));
    });
  } catch (e) {
    console.error(e);
  }
}

run();
