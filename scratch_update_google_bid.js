require('dotenv').config();
const gs = require('./server/services/meta.service'); // Wait! I need google.service
const google = require('./server/services/google.service');

async function updateBid() {
  try {
    const customer = google.getCustomer();
    const result = await customer.adGroups.update([
      {
        resource_name: 'customers/4432873398/adGroups/202799919784',
        cpc_bid_micros: 40 * 1e6
      }
    ]);
    console.log('--- GOOGLE BID UPDATE ---');
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
}

updateBid();
