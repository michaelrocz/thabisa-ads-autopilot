const ms = require('./server/services/meta.service');
require('dotenv').config();

async function listAdSets() {
  try {
    const adSets = await ms.getAdSets();
    const active = adSets.filter(a => a.status === 'ACTIVE');
    console.log(JSON.stringify(active, null, 2));
  } catch (e) {
    console.error(e);
  }
}

listAdSets();
