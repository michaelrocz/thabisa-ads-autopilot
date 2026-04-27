const meta = require('./server/services/meta.service');
require('dotenv').config();

async function performBudgetShift() {
  console.log("✂️ Shifting budget away from underperforming campaigns...");
  
  const losers = [
    { id: '120242874188150559', name: 'AP CAT', newBudget: 500 },
    { id: '120242984265600559', name: 'Final Apl', newBudget: 500 },
    { id: '120239961935030559', name: 'CT YELLOW', newBudget: 500 }
  ];

  for (const campaign of losers) {
    try {
      console.log(`📉 Reducing budget for ${campaign.name} to ₹${campaign.newBudget}...`);
      
      // Update Daily Budget (needs to be in cents for the API)
      await meta.apiPost(`/${campaign.id}`, {
        daily_budget: campaign.newBudget * 100
      });
      
      console.log(`✅ ${campaign.name} reduced.`);
    } catch (e) {
      console.error(`❌ Failed to update ${campaign.name}:`, e.message);
    }
  }

  console.log("🏁 Budget Shift Complete. Capital is now protected.");
}

performBudgetShift();
