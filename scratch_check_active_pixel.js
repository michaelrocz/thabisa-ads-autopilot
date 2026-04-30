require('dotenv').config();
const ms = require('./server/services/meta.service');

async function checkPixel() {
  try {
    const pixelId = '2089219804702392';
    const data = await ms.api(`/${pixelId}/stats`, {
      aggregation: 'event',
      start_time: Math.floor(Date.now() / 1000) - (24 * 3600)
    });
    console.log(`--- PIXEL STATS FOR ${pixelId} (Last 24h) ---`);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkPixel();
