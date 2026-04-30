const ms = require('./server/services/meta.service');
require('dotenv').config();

async function optimizeMetaTargeting() {
  const updates = [
    {
      id: '120243578092060559', // Kids & Baby
      interests: [
        { id: '6003232518610', name: 'Parenting' },
        { id: '6003415393053', name: "Children's clothing" }
      ]
    },
    {
      id: '120243578097890559', // Home Decor
      interests: [
        { id: '6002920953955', name: 'Interior design' },
        { id: '6003385735404', name: 'Home decorating ideas' }
      ]
    },
    {
      id: '120243578105870559', // Travel/Bags
      interests: [
        { id: '6003288328927', name: 'Ethical consumerism' }
      ]
    }
  ];

  for (const update of updates) {
    try {
      console.log(`Updating AdSet ${update.id}...`);
      // We need the current targeting first to merge
      const adSets = await ms.getAdSets();
      const current = adSets.find(a => a.id === update.id);
      
      if (!current) {
        console.warn(`AdSet ${update.id} not found.`);
        continue;
      }

      const newTargeting = {
        ...current.targeting,
        flexible_spec: [
          {
            interests: update.interests
          }
        ]
      };

      const result = await ms.updateAdSetTargeting(update.id, newTargeting);
      console.log(`Result for ${update.id}:`, JSON.stringify(result));
    } catch (e) {
      console.error(`Failed to update ${update.id}:`, e.message);
    }
  }
}

optimizeMetaTargeting();
