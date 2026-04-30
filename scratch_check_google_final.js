require('dotenv').config();
const gs = require('./server/services/google.service');

async function check() {
  try {
    const customer = gs.getCustomer();
    const cleanId = process.env.GOOGLE_CUSTOMER_ID.replace(/-/g, '');
    const campaignId = '23799651974';
    const data = await customer.campaigns.get(`customers/${cleanId}/campaigns/${campaignId}`);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

check();
