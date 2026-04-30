require('dotenv').config();
const ms = require('./server/services/meta.service');

async function check() {
  try {
    const ids = [
      '120243578092060559', // Kids_Baby
      '120243578097890559', // Home_Decor
      '120243578105870559'  // Travel
    ];
    for (const id of ids) {
      const data = await ms.api(`/${id}`, { fields: 'name,status,effective_status' });
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error(e);
  }
}

check();
