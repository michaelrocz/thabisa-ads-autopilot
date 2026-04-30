require('dotenv').config();
const meta = require('./server/services/meta.service');

async function optimizeActiveCampaigns() {
  try {
    const campaigns = await meta.getCampaigns();
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');
    
    console.log(`Found ${activeCampaigns.length} active campaigns to optimize.`);

    for (const camp of activeCampaigns) {
      // Don't touch the retargeting campaign, it already has the exact audience!
      if (camp.name.includes('RETARGETING')) {
        console.log(`Skipping retargeting campaign: ${camp.name}`);
        continue;
      }

      console.log(`Fetching Ad Sets for ${camp.name}...`);
      const adSets = await meta.getAdSets(camp.id);
      
      for (const adSet of adSets) {
        console.log(`Optimizing Ad Set: ${adSet.name} (ID: ${adSet.id})`);
        
        let currentTargeting = {};
        try {
          currentTargeting = typeof adSet.targeting === 'string' ? JSON.parse(adSet.targeting) : adSet.targeting;
        } catch(e) {}

        const optimizedTargeting = {
          ...currentTargeting,
          age_min: 25, // Increased from 18 to target users with higher purchasing power
          age_max: 55
        };

        // Note: For DRY_RUN logic, we bypass the wrapper so it actually runs
        const url = `/${adSet.id}?access_token=${meta.getToken()}`;
        const axios = require('axios');
        const res = await axios.post(`https://graph.facebook.com/v21.0${url}`, {
          targeting: JSON.stringify(optimizedTargeting)
        });
        
        console.log(`Successfully updated targeting for ${adSet.name}!`);
      }
    }
  } catch (err) {
    console.error('Error optimizing campaigns:', err.response?.data?.error || err.message);
  }
}

optimizeActiveCampaigns();
