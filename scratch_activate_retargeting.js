require('dotenv').config();
const ms = require('./server/services/meta.service');

async function activate() {
  try {
    console.log('Activating Retargeting...');
    await ms.apiPost('/120243685487190559', { status: 'ACTIVE' });
    await ms.apiPost('/120243685487420559', { status: 'ACTIVE' });
    await ms.apiPost('/120243685490720559', { status: 'ACTIVE' });
    console.log('Retargeting is LIVE!');
  } catch (e) {
    console.error(e);
  }
}

activate();
