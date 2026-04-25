require('dotenv').config();
const meta = require('./server/services/meta.service');

const AD_SET_ID = '120242984265590559';
const CAMPAIGN_ID = '120242984265600559';

async function optimize() {
  try {
    console.log('--- OPTIMIZING FINAL APL ---');
    
    // 1. Fetch current targeting
    const adSets = await meta.getAdSets(CAMPAIGN_ID);
    const currentAdSet = adSets.find(as => as.id === AD_SET_ID);
    if (!currentAdSet) throw new Error('Ad set not found');
    
    const targeting = currentAdSet.targeting;
    console.log('Current Age Range:', targeting.age_min, '-', targeting.age_max);
    
    // 2. Modify Age Range
    targeting.age_min = 25;
    targeting.age_max = 55;
    
    // Remove read-only or derived fields if any
    delete targeting.age_range; 
    
    console.log('Updating targeting to Age 25-55...');
    await meta.updateAdSetTargeting(AD_SET_ID, targeting);
    
    // 3. Activate Ad Set
    console.log('Activating Ad Set...');
    await meta.updateStatus(AD_SET_ID, 'ACTIVE');
    
    // 4. Activate Campaign
    console.log('Activating Campaign...');
    await meta.updateStatus(CAMPAIGN_ID, 'ACTIVE');
    
    console.log('✅ Final Apl is now ACTIVE with optimized targeting (Age 25-55).');
  } catch (e) {
    console.error('❌ Optimization failed:', e.message);
  }
}

optimize();
