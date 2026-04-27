const meta = require('./server/services/meta.service');
require('dotenv').config();

async function updatePetsOffer() {
  console.log("🐾 Implementing 'FREE GIFT' offer for Pets Collection...");
  
  try {
    const campaigns = await meta.getCampaigns();
    const petsCampaign = campaigns.find(c => c.name.includes('Pets_Collection'));
    
    if (!petsCampaign) {
      console.error("❌ Could not find Pets campaign.");
      return;
    }

    const adSets = await meta.api(`/${petsCampaign.id}/adsets`, { fields: 'id' });
    const ads = await meta.api(`/${adSets.data[0].id}/ads`, { fields: 'id,creative{id}' });
    const ad = ads.data[0];

    console.log(`🛰️ Updating Creative for Ad: ${ad.id}`);

    // Update the creative with the new high-converting offer
    await meta.apiPost(`/${ad.creative.id}`, {
      object_story_spec: JSON.stringify({
        page_id: '372752173550405',
        instagram_user_id: '17841408447309607',
        video_data: {
          video_id: '1821343958822281', // Dog bed video
          image_hash: 'f6fe5dbb55cc29774850b5b48a8e1f8c',
          call_to_action: { type: 'SHOP_NOW', value: { link: 'https://thabisa.shop/' } },
          message: "🐾 SPECIAL OFFER: FREE PET GIFT WITH EVERY PURCHASE! 🐾\n\nTreat your furry friend to the best. Shop our premium collection today and get a surprise gift for your pet! 🐶🐱\n\n✨ 10% OFF + FREE SHIPPING ✨",
          title: "FREE Pet Gift with Every Order! 🎁"
        }
      })
    });

    console.log("✅ Pets ad updated with FREE GIFT offer. Ready for sales!");
  } catch (e) {
    console.error("Update failed:", e.message);
  }
}

updatePetsOffer();
