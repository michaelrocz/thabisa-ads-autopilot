require('dotenv').config();
const meta = require('./server/services/meta.service');

const AD_SET_ID = '120242984265590559';
const CAMPAIGN_ID = '120242984265600559';

async function activateOnly() {
  try {
    console.log('--- ACTIVATING FINAL APL ---');
    
    // 1. Activate Ad Set
    console.log('Activating Ad Set...');
    await meta.updateStatus(AD_SET_ID, 'ACTIVE');
    
    // 2. Activate Campaign
    console.log('Activating Campaign...');
    await meta.updateStatus(CAMPAIGN_ID, 'ACTIVE');
    
    console.log('✅ Final Apl is now ACTIVE.');
  } catch (e) {
    console.error('❌ Activation failed:', e.message);
  }
}

activateOnly();
