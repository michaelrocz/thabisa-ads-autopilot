const axios = require('axios');

async function testToken() {
  const token = "EAA7qlrnMV9cBRTNpdlgZCZAm75QvcDojghGWc7ZCSPK6doDxLZCl26mSh2YpdJhUaSUoRX0ZAPkZBfdAKljufaLDDVO3awNCkEA4nYklDhtQDqRfzSrcNIO7AS8tbNaE1WUdZBpgCpgTQQerIIGrn8RhLFZCeoDUJTefZAwXQjIHjhuZADAfJdxnpB9nQ2LLZAvXCRQpQZDZD";
  try {
    const res = await axios.get(`https://graph.facebook.com/v21.0/me?access_token=${token}`);
    console.log("Token is valid! Connected as:", res.data);
  } catch (e) {
    console.error("Token error:", e.response?.data?.error?.message || e.message);
  }
}

testToken();
