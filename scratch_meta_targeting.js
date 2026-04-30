const ms = require('./server/services/meta.service');
require('dotenv').config(); // Load from .env

async function checkMetaTargeting() {
  try {
    const camps = await ms.getCampaigns();
    const active = camps.filter(c => c.status === 'ACTIVE');
    console.log(`Checking ${active.length} active Meta campaigns...`);

    for (const camp of active) {
      const adsets = await ms.getAdSets(camp.id);
      console.log(`\n[CAMPAIGN: ${camp.name}]`);
      adsets.forEach(a => {
        console.log(` - Ad Set: ${a.name}`);
        console.log(`   Targeting: ${JSON.stringify(a.targeting, null, 2)}`);
      });
    }
  } catch (e) {
    console.error('Meta check failed:', e);
  }
}

checkMetaTargeting();
