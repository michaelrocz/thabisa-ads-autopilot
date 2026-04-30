require('dotenv').config();
const ms = require('./server/services/meta.service');

async function checkAdSets() {
  try {
    const campaignId = '120243578092060559';
    const data = await ms.api(`/${campaignId}/adsets`, { fields: 'name,status' });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkAdSets();
