require('dotenv').config();
const ms = require('./server/services/meta.service');

async function checkAccount() {
  try {
    const accountId = 'act_2285838831476206';
    const data = await ms.api(`/${accountId}`, { fields: 'account_status,disable_reason,balance,amount_spent' });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkAccount();
