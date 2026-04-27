require('dotenv').config();
const meta = require('./server/services/meta.service');
const launcher = require('./server/services/launcher');

async function launchGoldStandard() {
  console.log("🔥 Launching THABISA GOLD STANDARD...");
  
  try {
    // 1. Get the "beach" video specifically
    const assets = await meta.getLibraryAssets();
    const beachVideo = assets.videos.find(v => v.id === '26627498366883631' || v.name?.includes('beach'));
    
    if (!beachVideo) {
      console.error("❌ Could not find the 'beach' video in library.");
      return;
    }

    console.log(`📹 Using Winning Creative: ${beachVideo.name} (${beachVideo.id})`);

    // 2. Launch Gold Standard Configuration
    const config = {
      productName: "Gold_Standard_Beach",
      primaryText: "✨ 10% OFF + FREE SHIPPING ✨\n\nExperience the premium quality of Thabisa. Shop our latest collection today and transform your style.",
      headline: "Thabisa — Free Shipping + 10% OFF",
      budget: 1000, // Starting with a strong ₹1000 budget
      assets: JSON.stringify([{
        id: beachVideo.id,
        type: 'video'
      }])
    };

    console.log("🛰️ Deploying LIVE Campaign...");
    const result = await launcher.createMetaCampaign(config);
    
    // 3. SET TO ACTIVE (The launcher creates campaigns as PAUSED by default in some versions, ensuring it's LIVE now)
    await meta.apiPost(`/${result.campaign_id}`, { status: 'ACTIVE' });
    
    console.log("✅ LIVE DEPLOYMENT SUCCESSFUL!", result);
    console.log(`🔗 View in Ads Manager: https://adsmanager.facebook.com/adsmanager/manage/ads?act=${process.env.META_AD_ACCOUNT_ID.replace('act_', '')}&selected_campaign_ids=${result.campaign_id}`);
    
  } catch (e) {
    console.error("❌ Launch Failed:", e.message);
  }
}

launchGoldStandard();
