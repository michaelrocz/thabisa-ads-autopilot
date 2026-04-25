require('dotenv').config();
const google = require('./server/services/google.service');

async function run() {
  try {
    const result = await google.testConnection();
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Google Error:', e.message);
  }
}

run();
