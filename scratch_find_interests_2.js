const ms = require('./server/services/meta.service');
require('dotenv').config();

async function findInterests() {
  const keywords = ['Home decor', 'Organic cotton', 'Baby products', 'Ethical consumerism'];
  const results = {};

  for (const q of keywords) {
    try {
      const data = await ms.api('/search', {
        type: 'adinterest',
        q,
        limit: 5
      });
      results[q] = data.data.map(i => ({ id: i.id, name: i.name }));
    } catch (e) {
      console.error(`Error searching for ${q}:`, e.message);
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

findInterests();
