require('dotenv').config();
const ms = require('./server/services/meta.service');

async function tightenPlacements() {
  const adSetIds = ['120243578093080559', '120243578101230559', '120243578106460559'];
  
  for (const id of adSetIds) {
    try {
      console.log(`Updating AdSet ${id} placements...`);
      await ms.apiPost(`/${id}`, {
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['feed'],
        instagram_positions: ['stream', 'story'],
        device_platforms: ['mobile', 'desktop']
      });
      console.log(`AdSet ${id} updated.`);
    } catch (e) {
      console.error(`Failed to update ${id}:`, e.message);
    }
  }
}

tightenPlacements();
