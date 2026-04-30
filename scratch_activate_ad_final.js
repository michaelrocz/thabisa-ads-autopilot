require('dotenv').config();
const ms = require('./server/services/meta.service');

async function activate() {
  try {
    const adId = '120243685490720559';
    const res = await ms.apiPost(`/${adId}`, { status: 'ACTIVE' });
    console.log('Ad Status Updated:', res);
  } catch (e) {
    console.error(e);
  }
}

activate();
