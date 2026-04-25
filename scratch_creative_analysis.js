require('dotenv').config();
const meta = require('./server/services/meta.service');

async function run() {
  const summary = await meta.getSummary();
  console.log('--- CREATIVE PERFORMANCE ANALYSIS ---');
  summary.campaigns_detail.forEach(c => {
    console.log(`\nCampaign: ${c.campaign_name}`);
    console.log(`CTR: ${c.ctr}%`);
    console.log(`Frequency: ${c.frequency}`);
    console.log(`CPC: ₹${c.cpc}`);
    console.log(`CPM: ₹${c.cpm}`);
    
    if (c.ctr < 0.8) console.log('⚠️ WARNING: Low CTR (Creative Fatigue/Weak Hook)');
    if (c.frequency > 3.0) console.log('⚠️ WARNING: High Frequency (Audience Saturation)');
  });
}

run();
