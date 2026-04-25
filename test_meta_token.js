const axios = require('axios');
const token = 'EAANRmLGRBTEBRYCUEk6GE19ZCtsZBlps5MOZBz2TSWD5QKKpvRiV41E12IsEbcwNpZBZBWX7vTC9rZBPP4W6xhfEG2xuts8rekmKKA7WMPsKuB1WjW5tmLosuMaLjkcW5Kvc4DKiXl697GDoawjo7MI2T5ZCZBW19F0kIzXOcWA2I5RsfH5XdZACsMg8N66idFB8uysaOFyO3EJzhDQqlOY3LfQI7DLlqXKA3yvofcZAj2laQLeGlhkcX2NUemuMZBMjVtHn6S7B3fIjN96W4hfTDZC4W792QRtTlXlVkr0D62TjDwUHKE75Yds1YTTnOYwfYmnv8PdOKZBdOuLwMGGcZD';
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
