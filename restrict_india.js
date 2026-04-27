const meta = require('./server/services/meta.service');
require('dotenv').config();

async function restrictToIndia() {
  console.log("🇮🇳 Restricting all 'Gold Standard' campaigns to India only...");
  
  try {
    const campaigns = await meta.getCampaigns();
    const newCampaigns = campaigns.filter(c => c.name.includes('Gold_Standard_'));
    
    for (const campaign of newCampaigns) {
      console.log(`📍 Updating Targeting for: ${campaign.name}`);
      
      const adSets = await meta.api(`/${campaign.id}/adsets`, { fields: 'id,name' });
      for (const adSet of adSets.data) {
        // Force update targeting to India only
        await meta.apiPost(`/${adSet.id}`, {
          targeting: JSON.stringify({
            geo_locations: { countries: ['IN'] },
            publisher_platforms: ['facebook', 'instagram'],
            age_min: 18
          })
        });
        console.log(`✅ Ad Set ${adSet.name} restricted to India.`);
      }
    }
    
    console.log("🏁 All campaigns are now India-only!");
  } catch (e) {
    console.error("Targeting update failed:", e.message);
  }
}

restrictToIndia();
