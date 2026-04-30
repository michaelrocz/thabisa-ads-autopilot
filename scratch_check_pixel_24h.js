require('dotenv').config();
const ms = require('./server/services/meta.service');

async function checkPixelFull() {
  try {
    const pixelId = '2089219804702392';
    const data = await ms.api(`/${pixelId}/stats`, {
      aggregation: 'event',
      start_time: Math.floor(Date.now() / 1000) - (24 * 3600)
    });
    console.log(`--- PIXEL STATS FOR ${pixelId} (Last 24h) ---`);
    const aggregated = {};
    data.data.forEach(h => {
      h.data.forEach(e => {
        aggregated[e.value] = (aggregated[e.value] || 0) + e.count;
      });
    });
    console.log(JSON.stringify(aggregated, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkPixelFull();
