const meta = require('./server/services/meta.service');
require('dotenv').config();

async function scaleWinner() {
  console.log("🚀 Scaling the PETS WINNER...");
  try {
    const campaigns = await meta.getCampaigns();
    const pets = campaigns.find(c => c.name.includes('Pets_Collection'));
    
    if (pets) {
      await meta.apiPost(`/${pets.id}`, {
        daily_budget: 1000 * 100
      });
      console.log(`✅ Pets campaign (${pets.id}) scaled to ₹1000.`);
    }
  } catch (e) {
    console.error("Scale failed:", e.message);
  }
}

scaleWinner();
