require('dotenv').config();
const ms = require('./server/services/meta.service');

async function checkStatus() {
  try {
    const campaignId = '120243685487190559';
    const adSetId = '120243685487420559';
    const campaign = await ms.api(`/${campaignId}`, { fields: 'status' });
    const adSet = await ms.api(`/${adSetId}`, { fields: 'status' });
    console.log('Campaign Status:', campaign.status);
    console.log('AdSet Status:', adSet.status);
  } catch (e) {
    console.error(e);
  }
}

checkStatus();
