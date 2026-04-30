// Vercel serverless entry — loads env and exports Express app [REBUILD_FORCE_1]
const path = require('path');
// Load .env for local dev; on Vercel, env vars are set in dashboard
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const app = require('../server/app');
module.exports = app;
