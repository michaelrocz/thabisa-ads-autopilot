const meta = require('./server/services/meta.service');
require('dotenv').config();

async function purgeCriticalCampaigns() {
  console.log("🚑 Restoring Account Health by pausing CRITICAL losers...");
  
  try {
    const summary = await meta.getSummary();
    const criticals = summary.campaigns_detail.filter(c => c.health_status === 'CRITICAL');
    
    console.log(`Found ${criticals.length} critical campaigns.`);

    for (const campaign of criticals) {
      console.log(`⏸️ Pausing ${campaign.campaign_name} (ROAS: ${campaign.roas})...`);
      await meta.apiPost(`/${campaign.campaign_id}`, { status: 'PAUSED' });
      console.log(`✅ ${campaign.campaign_name} is now paused.`);
    }
    
    console.log("🏁 Health Restoration Complete!");
  } catch (e) {
    console.error("Purge failed:", e.message);
  }
}

purgeCriticalCampaigns();
