const axios = require('axios');
const token = 'EAA7qlrnMV9cBRTNpdlgZCZAm75QvcDojghGWc7ZCSPK6doDxLZCl26mSh2YpdJhUaSUoRX0ZAPkZBfdAKljufaLDDVO3awNCkEA4nYklDhtQDqRfzSrcNIO7AS8tbNaE1WUdZBpgCpgTQQerIIGrn8RhLFZCeoDUJTefZAwXQjIHjhuZADAfJdxnpB9nQ2LLZAvXCRQpQZDZD';
const accountId = 'act_2285838831476206';

async function test() {
  try {
    const res = await axios.get(`https://graph.facebook.com/v21.0/${accountId}`, {
      params: { access_token: token, fields: 'id,name,account_status' }
    });
    console.log('SUCCESS:', res.data);
  } catch (err) {
    console.log('ERROR:', err.response?.data?.error || err.message);
  }
}

test();
