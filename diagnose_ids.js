require('dotenv').config();
const axios = require('axios');

async function findIds() {
  console.log("Checking Meta Account for missing IDs...");
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  
  try {
    // Try to find Page ID from existing ads
    const adsRes = await axios.get(`https://graph.facebook.com/v21.0/${accountId}/ads?fields=creative{object_story_spec{page_id}}&limit=5&access_token=${token}`);
    const pageIds = adsRes.data.data
      .map(ad => ad.creative?.object_story_spec?.page_id)
      .filter(id => id);
    
    console.log("Detected Page IDs from existing ads:", [...new Set(pageIds)]);
  } catch (e) {
    console.error("Diagnostic failed:", e.response?.data?.error?.message || e.message);
  }
}

findIds();
