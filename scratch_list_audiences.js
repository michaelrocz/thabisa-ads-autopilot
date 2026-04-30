const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.production') });
const ms = require('./server/services/meta.service');

async function listAudiences() {
  try {
    const accountId = process.env.META_AD_ACCOUNT_ID;
    const data = await ms.api(`/${accountId}/customaudiences`, {
      fields: 'id,name,description,approximate_count'
    });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

listAudiences();
