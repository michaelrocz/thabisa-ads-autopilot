const meta = require('./server/services/meta.service');
require('dotenv').config();

const thumbnails = {
  Pets: 'f6fe5dbb55cc29774850b5b48a8e1f8c', // Dog bed thumb
  Runners: '1368146648406356_thumb', // Runner thumb (placeholder hash, will use auto)
  Nursing: '712916895212407_thumb',
  Muslin: '1654928388989886_thumb',
  Beach: '1307349157945399_thumb'
};

async function forceThumbnailSync() {
  console.log("🖼️ Force-Syncing thumbnails for visual perfection...");
  
  const campaigns = await meta.getCampaigns();
  const goldCampaigns = campaigns.filter(c => c.name.includes('Gold_Standard_'));

  for (const campaign of goldCampaigns) {
    const adSets = await meta.api(`/${campaign.id}/adsets`, { fields: 'id' });
    const ads = await meta.api(`/${adSets.data[0].id}/ads`, { fields: 'id,name,creative{id}' });
    
    const ad = ads.data[0];
    console.log(`✨ Refreshing Preview for: ${ad.name}`);
    
    // We update the creative name to force Meta to re-render the thumbnail
    await meta.apiPost(`/${ad.creative.id}`, {
      name: `Final_Production_Creative_${Date.now()}`
    });
  }
  
  console.log("✅ Visual sync complete!");
}

forceThumbnailSync();
