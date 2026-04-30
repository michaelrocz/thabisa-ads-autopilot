require('dotenv').config();
const gs = require('./server/services/google.service');

async function checkStatus() {
  try {
    const campaigns = await gs.getCampaigns();
    const target = campaigns.find(x => x.id === '23799651974');
    console.log('--- GOOGLE CAMPAIGN STATUS ---');
    if (target) {
      console.log(JSON.stringify(target, null, 2));
    } else {
      console.log('Campaign not found in list.');
    }
  } catch (e) {
    console.error(e);
  }
}

checkStatus();
