const gs = require('./server/services/google.service');
const ms = require('./server/services/meta.service');
require('dotenv').config();

async function checkPerformance() {
  try {
    const [google, meta] = await Promise.all([
      gs.getSummary(),
      ms.getSummary()
    ]);

    console.log('--- GOOGLE PERFORMANCE ---');
    console.log(`Total Spend: ${google.total_spend} ${google.currency}`);
    console.log(`Conversions: ${google.total_conversions}`);
    console.log(`Active Campaigns: ${google.active_campaigns}`);
    
    console.log('\n--- META PERFORMANCE ---');
    console.log(`Total Spend: ${meta.total_spend} ${meta.currency}`);
    console.log(`Conversions: ${meta.total_conversions}`);
    console.log(`Active Campaigns: ${meta.active_campaigns}`);

    console.log('\n--- DIAGNOSIS ---');
    if (google.total_spend === 0 && meta.total_spend === 0) {
      console.log('No spend yet today/this period. The system might be too restrictive or campaigns are newly created.');
    } else if (google.total_conversions === 0 && meta.total_conversions === 0) {
      console.log('Spending is happening but no conversions. High risk of bot traffic or poor landing page experience.');
    }
  } catch (e) {
    console.error('Performance check failed:', e);
  }
}

checkPerformance();
