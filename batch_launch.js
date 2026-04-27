const launcher = require('./server/services/launcher');
const meta = require('./server/services/meta.service');
require('dotenv').config();

async function batchLaunch() {
  const campaigns = [
    {
      name: "Beach_Bags",
      assetId: "26627498366883631",
      primary: "✨ Ready for the Sun? ✨\nOur premium beach bags are your perfect summer companion. Durable, stylish, and now 10% OFF!",
      headline: "Beach Bags — 10% OFF + Free Shipping"
    },
    {
      name: "Nursing_Pillow",
      assetId: "1557403525806640",
      primary: "🍼 Comfort for Mom & Baby 🍼\nSupport your nursing journey with our ergonomic pillows. Designed for comfort, loved by moms.",
      headline: "Nursing Pillows — Best Quality & Free Shipping"
    },
    {
      name: "Table_Runners",
      assetId: "1461857059069169",
      primary: "🍽️ Elevate Your Dining 🍽️\nTransform your table with our premium runners. Perfect for every occasion. Shop the collection now!",
      headline: "Premium Table Runners — 10% OFF Today"
    },
    {
      name: "Pets_Collection",
      assetId: "929238366200443",
      primary: "🐾 Pamper Your Furry Friends 🐾\nOnly the best for your pets. Discover our new pet collection. Quality you can trust.",
      headline: "Pet Essentials — 10% OFF + Free Shipping"
    },
    {
      name: "Muslin_Slings",
      assetId: "1268987112073793",
      primary: "☁️ Softness Like No Other ☁️\nPremium muslin slings for your little one. Breathable, safe, and beautifully designed.",
      headline: "Premium Muslin — Shop the Softest Collection"
    }
  ];

  console.log(`🚀 Starting Big Batch Launch for ${campaigns.length} categories...`);

  for (const config of campaigns) {
    try {
      console.log(`🛰️ Launching: ${config.name}...`);
      const result = await launcher.createMetaCampaign({
        productName: `Gold_Standard_${config.name}`,
        primaryText: config.primary,
        headline: config.headline,
        budget: 500, // Small starting budget per category
        assets: JSON.stringify([{ id: config.assetId, type: 'video' }])
      });
      
      // Ensure it's ACTIVE
      await meta.apiPost(`/${result.campaign_id}`, { status: 'ACTIVE' });
      console.log(`✅ ${config.name} is LIVE! ID: ${result.campaign_id}`);
    } catch (e) {
      console.error(`❌ Failed to launch ${config.name}:`, e.message);
    }
  }

  console.log("🏁 All 5 categories have been processed!");
}

batchLaunch();
