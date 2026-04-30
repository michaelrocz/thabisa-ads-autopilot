require('dotenv').config();
const ms = require('./server/services/meta.service');

async function checkPixel() {
  try {
    const pixelId = '2089219804702392';
    const data = await ms.api(`/${pixelId}/stats`, {
      aggregation: 'event',
      start_time: Math.floor(Date.now() / 1000) - 900 // Last 15 mins
    });
    console.log(`--- PIXEL STATS FOR ${pixelId} (Last 15m) ---`);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkPixel();
