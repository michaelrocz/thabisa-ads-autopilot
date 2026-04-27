const meta = require('./server/services/meta.service');
require('dotenv').config();

async function check() {
  try {
    const summary = await meta.getSummary('last_7d');
    console.log('--- CAMPAIGN STATUS REPORT ---');
    console.log(`Account: ${summary.account_id}`);
    console.log(`Total Spend (7d): ₹${summary.total_spend}`);
    console.log(`Blended ROAS: ${summary.blended_roas}x`);
    console.log(`Active Campaigns: ${summary.active_campaigns}`);
    console.log('\nTop Campaigns:');
    summary.campaigns_detail.slice(0, 5).forEach(c => {
      console.log(`- ${c.campaign_name}: ₹${c.spend} | ROAS: ${c.roas}x | Status: ${c.status} [${c.health_status}]`);
    });
    
    if (summary.flagged_count > 0) {
      console.log('\n⚠️ Flagged Issues:');
      summary.flagged.forEach(f => {
        console.log(`- ${f.campaign_name}: ${f.flags.join(', ')}`);
      });
    }
  } catch (e) {
    console.error('Failed to fetch status:', e.message);
  }
}

check();
