require('dotenv').config();
const gs = require('./server/services/google.service');

async function updateBudget() {
  try {
    const customer = gs.getCustomer();
    const cleanId = process.env.GOOGLE_CUSTOMER_ID.replace(/-/g, '');
    const budgetResourceName = `customers/${cleanId}/campaignBudgets/11881799919788`;
    
    console.log('Updating Google Budget to ₹1000...');
    await customer.campaignBudgets.update([{
      resource_name: budgetResourceName,
      amount_micros: 1000 * 1e6
    }]);
    console.log('Done.');
  } catch (e) {
    console.error(e);
  }
}

updateBudget();
