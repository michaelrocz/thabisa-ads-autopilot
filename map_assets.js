const meta = require('./server/services/meta.service');
require('dotenv').config();

async function mapAssets() {
  console.log("🔍 Scanning Meta Media Library...");
  try {
    const assets = await meta.getLibraryAssets();
    
    const mapping = {
      beach_bags: assets.videos.find(v => v.id === '26627498366883631') || assets.videos[0],
      nursing: assets.videos.find(v => v.name?.toLowerCase().includes('mom') || v.name?.toLowerCase().includes('nursing')) || assets.videos[1],
      runners: assets.videos.find(v => v.name?.toLowerCase().includes('table') || v.name?.toLowerCase().includes('runner')) || assets.videos[2],
      pets: assets.videos.find(v => v.name?.toLowerCase().includes('pet') || v.name?.toLowerCase().includes('dog')) || assets.videos[3],
      muslin: assets.videos.find(v => v.name?.toLowerCase().includes('muslin') || v.name?.toLowerCase().includes('sling')) || assets.videos[4]
    };

    console.log("🎯 Category Mappings found:");
    for (const [cat, asset] of Object.entries(mapping)) {
      if (asset) {
        console.log(`- ${cat.toUpperCase()}: Using ${asset.name || 'Video'} (${asset.id})`);
      } else {
        console.log(`- ${cat.toUpperCase()}: ⚠️ No specific asset found, will use fallback.`);
      }
    }
    
    return mapping;
  } catch (e) {
    console.error("Mapping failed:", e.message);
  }
}

mapAssets();
