require('dotenv').config();
const ms = require('./server/services/meta.service');

async function updateAd() {
  try {
    const adId = '120243685490720559';
    const pixelId = '2089219804702392';
    
    console.log('Updating Ad with tracking...');
    await ms.apiPost(`/${adId}`, {
      tracking_specs: JSON.stringify([
        {
          action_type: ['offsite_conversion'],
          device: ['pixel'],
          pixel: [pixelId]
        }
      ]),
      status: 'ACTIVE'
    });
    console.log('Ad updated and activated!');
  } catch (e) {
    console.error(e);
  }
}

updateAd();
