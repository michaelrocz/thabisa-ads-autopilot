require('dotenv').config();
const ms = require('./server/services/meta.service');

async function checkRef() {
  try {
    const adId = '120243578096930559';
    const data = await ms.api(`/${adId}`, { fields: 'name,creative,tracking_specs,status' });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkRef();
