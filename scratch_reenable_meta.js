require('dotenv').config();
const ms = require('./server/services/meta.service');

async function reenable() {
  try {
    const ids = ['120243578092060559', '120243578097890559', '120243578105870559'];
    for (const id of ids) {
      console.log(`Re-enabling ${id}...`);
      await ms.apiPost(`/${id}`, { status: 'ACTIVE' });
    }
    console.log('Done.');
  } catch (e) {
    console.error(e);
  }
}

reenable();
