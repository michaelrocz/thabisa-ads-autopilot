const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.production') });
const google = require('./server/services/google.service');

async function check() {
  try {
    const campaigns = await google.getCampaigns();
    console.log(JSON.stringify(campaigns, null, 2));
  } catch (e) {
    console.error(e);
  }
}

check();
