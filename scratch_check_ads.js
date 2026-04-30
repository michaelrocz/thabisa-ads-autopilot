require('dotenv').config();
const ms = require('./server/services/meta.service');

async function checkAds() {
  try {
    const adSetId = '120243578093080559';
    const data = await ms.api(`/${adSetId}/ads`, {
      fields: 'name,adcreatives{name,body,title,image_url}'
    });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkAds();
