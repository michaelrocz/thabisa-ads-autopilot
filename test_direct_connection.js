const axios = require('axios');

async function testDirect() {
  const token = "EAA7qlrnMV9cBRTNpdlgZCZAm75QvcDojghGWc7ZCSPK6doDxLZCl26mSh2YpdJhUaSUoRX0ZAPkZBfdAKljufaLDDVO3awNCkEA4nYklDhtQDqRfzSrcNIO7AS8tbNaE1WUdZBpgCpgTQQerIIGrn8RhLFZCeoDUJTefZAwXQjIHjhuZADAfJdxnpB9nQ2LLZAvXCRQpQZDZD";
  const accountId = "act_2285838831476206";
  try {
    console.log("Checking direct account videos...");
    const res = await axios.get(`https://graph.facebook.com/v21.0/${accountId}/advideos?access_token=${token}`);
    console.log("SUCCESS! Found videos:", res.data.data?.length || 0);
  } catch (e) {
    console.error("Direct check failed:", e.response?.data?.error?.message || e.message);
    
    console.log("Trying with App ID param...");
    try {
        const res2 = await axios.get(`https://graph.facebook.com/v21.0/${accountId}/advideos?access_token=${token}&app_id=4198582757119959`);
        console.log("SUCCESS with App ID!", res2.data.data?.length || 0);
    } catch (e2) {
        console.error("App ID check failed too:", e2.response?.data?.error?.message || e2.message);
    }
  }
}

testDirect();
