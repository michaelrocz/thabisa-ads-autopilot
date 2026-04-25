const axios = require('axios');

async function findAppId() {
  const token = "EAA7qlrnMV9cBRTNpdlgZCZAm75QvcDojghGWc7ZCSPK6doDxLZCl26mSh2YpdJhUaSUoRX0ZAPkZBfdAKljufaLDDVO3awNCkEA4nYklDhtQDqRfzSrcNIO7AS8tbNaE1WUdZBpgCpgTQQerIIGrn8RhLFZCeoDUJTefZAwXQjIHjhuZADAfJdxnpB9nQ2LLZAvXCRQpQZDZD";
  try {
    const res = await axios.get(`https://graph.facebook.com/v21.0/app?access_token=${token}`);
    console.log("APP_ID_FOUND:", res.data.id);
  } catch (e) {
    console.error("Error finding App ID:", e.response?.data?.error?.message || e.message);
  }
}

findAppId();
