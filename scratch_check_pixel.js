require('dotenv').config();
const ms = require('./server/services/meta.service');

async function checkPixel() {
  try {
    const data = await ms.api(`/${process.env.META_PIXEL_ID}/stats`, {
      aggregation: 'event',
      start_time: Math.floor(Date.now() / 1000) - (24 * 3600)
    });
    console.log('--- PIXEL STATS (Last 24h) ---');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkPixel();
