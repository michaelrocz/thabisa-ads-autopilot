const meta = require('./server/services/meta.service');
require('dotenv').config();

async function inspectBeachCreative() {
  const accountId = "act_2285838831476206";
  try {
    console.log("Fetching the 'beach' ad creative...");
    const res = await meta.api(`/${accountId}/adcreatives`, { 
        fields: 'name,object_story_spec,object_type,video_id,image_hash,body,title,call_to_action_type', 
        limit: 50 
    });
    
    const beach = res.data.find(c => c.name.toLowerCase().includes('beach'));
    if (beach) {
        console.log(`--- Creative: ${beach.name} ---`);
        console.log(JSON.stringify(beach, null, 2));
    } else {
        console.log("Could not find 'beach' creative. Showing first one:");
        console.log(JSON.stringify(res.data[0], null, 2));
    }
  } catch (e) {
    console.error("Inspection failed:", e.message);
  }
}

inspectBeachCreative();
