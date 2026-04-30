require('dotenv').config();
const ms = require('./server/services/meta.service');

async function checkAd() {
  try {
    const adId = '120243685490720559';
    const data = await ms.api(`/${adId}`, { fields: 'name,status,creative' });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkAd();
