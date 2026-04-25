require('dotenv').config();
const meta = require('./server/services/meta.service');

async function run() {
  const adSets = await meta.getAdSets('120242984265600559');
  console.log(JSON.stringify(adSets, null, 2));
}

run();
