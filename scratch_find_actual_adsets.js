const ms = require('./server/services/meta.service');
require('dotenv').config();

async function findActualAdSets() {
  const campaignIds = ['120243578092060559', '120243578097890559', '120243578105870559'];
  for (const cid of campaignIds) {
    try {
      console.log(`Checking Campaign ${cid}...`);
      const adSets = await ms.api(`/${cid}/adsets`, { fields: 'id,name,targeting' });
      console.log(`AdSets for ${cid}:`, JSON.stringify(adSets.data, null, 2));
    } catch (e) {
      console.error(`Error for ${cid}:`, e.message);
    }
  }
}

findActualAdSets();
