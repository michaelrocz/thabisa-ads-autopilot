const meta = require('./server/services/meta.service');
require('dotenv').config();

const ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_2285838831476206';

async function updatePetsOfferFixed() {
  console.log("🐾 Implementing 'FREE GIFT' offer (New Creative) for Pets...");
  
  try {
    const campaigns = await meta.getCampaigns();
    const petsCampaign = campaigns.find(c => c.name.includes('Pets_Collection'));
    
    if (!petsCampaign) {
      console.error("❌ Could not find Pets campaign.");
      return;
    }

    const adSets = await meta.api(`/${petsCampaign.id}/adsets`, { fields: 'id' });
    const ads = await meta.api(`/${adSets.data[0].id}/ads`, { fields: 'id' });
    const adId = ads.data[0].id;

    console.log(`🛰️ Creating NEW Creative for Ad ID: ${adId}`);

    // 1. Create the new creative
    const creative = await meta.apiPost(`/${ACCOUNT_ID}/adcreatives`, {
      name: `Pets_FreeGift_Offer_${Date.now()}`,
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

    // 2. Link the new creative to the ad
    await meta.apiPost(`/${adId}`, {
      creative: JSON.stringify({ creative_id: creative.id })
    });

    console.log("✅ Pets ad now has the LIVE 'FREE GIFT' offer!");
  } catch (e) {
    console.error("Update failed:", e.message);
  }
}

updatePetsOfferFixed();
