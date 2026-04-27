const meta = require('./server/services/meta.service');
require('dotenv').config();

async function inspectCreative() {
  const accountId = "act_2285838831476206";
  try {
    console.log("Fetching existing creatives for inspiration...");
    const res = await meta.api(`/${accountId}/adcreatives`, { fields: 'name,object_story_spec,object_type', limit: 5 });
    
    for (const creative of res.data) {
        if (creative.object_story_spec) {
            console.log(`--- Creative: ${creative.name} ---`);
            console.log(JSON.stringify(creative.object_story_spec, null, 2));
            return; // Just show one
        }
    }
  } catch (e) {
    console.error("Inspection failed:", e.message);
  }
}

inspectCreative();
