const meta = require('./server/services/meta.service');
require('dotenv').config();

const ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_2285838831476206';
const PAGE_ID = '372752173550405';
const INSTAGRAM_ID = '17841408447309607';

async function fixAdCreatives() {
  const corrections = [
    { name: "Pets", videoId: "1821343958822281", campaignName: "Gold_Standard_Pets_Collection" },
    { name: "Runners", videoId: "2048808952381151", campaignName: "Gold_Standard_Table_Runners" },
    { name: "Nursing", videoId: "712916895212407", campaignName: "Gold_Standard_Nursing_Pillow" },
    { name: "Muslin", videoId: "1654928388989886", campaignName: "Gold_Standard_Muslin_Slings" },
    { name: "Beach", videoId: "1307349157945399", campaignName: "Gold_Standard_Beach_Bags" }
  ];

  console.log("🛠️ Starting Precision Creative Fix...");

  // 1. Get all current ads to find the ones to update
  const campaigns = await meta.getCampaigns();
  
  for (const fix of corrections) {
    const campaign = campaigns.find(c => c.name.includes(fix.campaignName));
    if (!campaign) {
      console.warn(`⚠️ Could not find campaign: ${fix.campaignName}`);
      continue;
    }

    console.log(`🛰️ Correcting ${fix.name} ad in ${campaign.name}... (ID: ${campaign.id})`);
    
    // Create new correct creative
    const creative = await meta.apiPost(`/${ACCOUNT_ID}/adcreatives`, {
      name: `Fixed_Creative_${fix.name}`,
      object_story_spec: JSON.stringify({
        page_id: PAGE_ID,
        instagram_user_id: INSTAGRAM_ID,
        video_data: {
          video_id: fix.videoId,
          image_hash: 'f6fe5dbb55cc29774850b5b48a8e1f8c', // Stable thumbnail
          call_to_action: { type: 'SHOP_NOW', value: { link: 'https://thabisa.shop/' } },
          message: "✨ Premium Quality for you and your loved ones ✨\nShop the collection today with 10% OFF + Free Shipping.",
          title: `Thabisa ${fix.name} Collection`
        }
      })
    });

    // Get the ad for this campaign
    const adSets = await meta.api(`/${campaign.id}/adsets`, { fields: 'id' });
    const adSetId = adSets.data[0].id;
    const ads = await meta.api(`/${adSetId}/ads`, { fields: 'id' });
    const adId = ads.data[0].id;

    // Update the ad to use the new creative
    await meta.apiPost(`/${adId}`, {
      creative: JSON.stringify({ creative_id: creative.id })
    });

    console.log(`✅ ${fix.name} ad is now correctly linked to video ${fix.videoId}`);
  }

  console.log("🏁 All corrections applied!");
}

fixAdCreatives();
