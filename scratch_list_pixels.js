require('dotenv').config();
const ms = require('./server/services/meta.service');

async function listPixels() {
  try {
    const data = await ms.getPixelHealth();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

listPixels();
