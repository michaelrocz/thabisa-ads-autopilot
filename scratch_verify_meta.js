require('dotenv').config();
const ms = require('./server/services/meta.service');

async function verify() {
  try {
    const ids = ['120243578093080559', '120243578101230559', '120243578106460559'];
    const results = await Promise.all(ids.map(id => ms.api(`/${id}`, { fields: 'name,targeting' })));
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    console.error(e);
  }
}

verify();
