require('dotenv').config();
const meta = require('./server/services/meta.service');
const launcher = require('./server/services/launcher');
const logger = require('./server/utils/logger');

async function runDummyTest() {
  console.log("🚀 Starting Dummy Test...");
  try {
    // 1. Get library assets
    const assets = await meta.getLibraryAssets();
    const image = assets.images[0]; 
    
    if (!image) {
      console.error("❌ No image found in your Meta Library.");
      return;
    }
    
    console.log(`🖼️ Selected Image: ${image.name} (${image.hash})`);
    
    // 2. Launch Campaign (Gold Standard)
    const config = {
      productName: "Autopilot Dummy Test",
      primaryText: "Test campaign for Autopilot system connection.",
      headline: "Test Headline",
      budget: 500, // Small budget
      assets: JSON.stringify([{
        id: image.hash,
        type: 'image'
      }])
    };
    
    console.log("🛰️ Deploying Campaign...");
    const result = await launcher.createMetaCampaign(config);
    console.log("✅ Campaign Created!", result);
    
    // 3. PAUSE IT IMMEDIATELY
    console.log("⏸️ Pausing Campaign for safety...");
    // We need to pause the campaign itself
    const campaignId = result.campaign_id;
    // We can use a direct axios call or extend meta service. 
    // For now, let's just use the pauseAdSet logic or a direct update.
    await meta.apiPost(`/${campaignId}`, { status: 'PAUSED' });
    console.log(`🏁 Success! Campaign ${campaignId} created and PAUSED.`);
    
  } catch (e) {
    console.error("❌ Test Failed:", e.message);
  }
}

runDummyTest();
