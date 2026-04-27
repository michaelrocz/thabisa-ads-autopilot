const meta = require('./server/services/meta.service');
require('dotenv').config();

const ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_2285838831476206';

async function deepCleanAds() {
  console.log("🧹 Starting Deep Clean of newly launched campaigns...");
  
  try {
    const campaigns = await meta.getCampaigns();
    const newCampaigns = campaigns.filter(c => c.name.includes('Gold_Standard_'));
    
    console.log(`Found ${newCampaigns.length} new campaigns to clean.`);

    for (const campaign of newCampaigns) {
      console.log(`🔍 Cleaning Campaign: ${campaign.name}`);
      
      const adSets = await meta.api(`/${campaign.id}/adsets`, { fields: 'id' });
      for (const adSet of adSets.data) {
        const ads = await meta.api(`/${adSet.id}/ads`, { fields: 'id,name,status,creative' });
        
        // In each Ad Set, we only want ONE ad. The one I just fixed.
        // We will delete any other ads in these specific new campaigns.
        if (ads.data.length > 1) {
          console.log(`⚠️ Found ${ads.data.length} ads in adset ${adSet.id}. Removing duplicates...`);
          
          // Keep the "Fixed_Creative" one or the latest one, delete the others.
          const toDelete = ads.data.filter(ad => !ad.name.includes('Fixed_Creative') && ads.data.indexOf(ad) !== 0);
          
          for (const ad of toDelete) {
            await meta.apiPost(`/${ad.id}`, { status: 'ARCHIVED' });
            console.log(`✅ Archived redundant ad: ${ad.name}`);
          }
        }
      }
    }
    
    console.log("🏁 Deep Clean complete!");
  } catch (e) {
    console.error("Clean failed:", e.message);
  }
}

deepCleanAds();
