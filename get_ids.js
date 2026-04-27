const meta = require('./server/services/meta.service');
require('dotenv').config();

async function getExactIds() {
  const assets = await meta.getLibraryAssets();
  assets.videos.forEach(v => {
    console.log(`[VIDEO] Name: ${v.name} | ID: ${v.id} | Title: ${v.title}`);
  });
}

getExactIds();
