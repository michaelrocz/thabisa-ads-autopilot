const meta = require('./server/services/meta.service');
require('dotenv').config();

async function cleanup() {
  try {
    const campaigns = await meta.getCampaigns();
    const dummies = campaigns.filter(c => c.name.includes('AUTOPILOT_SALES') || c.name.includes('AUTOPILOT_BROWSER_TEST'));
    console.log(`Found ${dummies.length} dummy campaigns.`);
    
    for (const c of dummies) {
      await meta.apiPost(`/${c.id}`, { status: 'ARCHIVED' });
      console.log(`✅ Archived: ${c.name}`);
    }
  } catch (e) {
    console.error("Cleanup failed:", e.message);
  }
}

cleanup();
