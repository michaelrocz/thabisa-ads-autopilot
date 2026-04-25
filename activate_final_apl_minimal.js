require('dotenv').config();
const meta = require('./server/services/meta.service');

const AD_SET_ID = '120242984265590559';
const CAMPAIGN_ID = '120242984265600559';

async function optimize() {
  try {
    console.log('--- OPTIMIZING FINAL APL (MINIMAL) ---');
    
    // 1. Update ONLY Age
    console.log('Updating targeting to Age 25-55...');
    await meta.updateAdSetTargeting(AD_SET_ID, {
      age_min: 25,
      age_max: 55
    });
    
    // 2. Activate Ad Set
    console.log('Activating Ad Set...');
    await meta.updateStatus(AD_SET_ID, 'ACTIVE');
    
    // 3. Activate Campaign
    console.log('Activating Campaign...');
    await meta.updateStatus(CAMPAIGN_ID, 'ACTIVE');
    
    console.log('✅ Final Apl is now ACTIVE with optimized targeting (Age 25-55).');
  } catch (e) {
    console.error('❌ Optimization failed:', e.message);
  }
}

optimize();
