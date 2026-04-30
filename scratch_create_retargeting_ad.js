require('dotenv').config();
const ms = require('./server/services/meta.service');

async function createRetargetingAd() {
  try {
    const accountId = process.env.META_AD_ACCOUNT_ID;
    const adSetId = '120243685487420559';
    
    // 1. Create Creative
    console.log('Creating Creative...');
    const creative = await ms.apiPost(`/${accountId}/adcreatives`, {
      name: 'Retargeting Creative - 2026-04-29',
      object_story_spec: JSON.stringify({
        page_id: process.env.META_PAGE_ID,
        link_data: {
          link: 'https://thabisa.shop/',
          message: 'Still thinking about it? Thabisa essentials are waiting for you. Get 10% OFF your first order with code: WELCOME10 ✨',
          image_hash: 'f49ed80cbc155071cb4652812adb3a4a', // Reusing the high-performing image
          call_to_action: { type: 'SHOP_NOW' }
        }
      })
    });
    
    console.log('Creative created:', JSON.stringify(creative));
    
    // 2. Create Ad
    console.log('Creating Ad...');
    const ad = await ms.apiPost(`/${accountId}/ads`, {
      name: 'Retargeting Ad - All Visitors',
      adset_id: adSetId,
      creative: JSON.stringify({ creative_id: creative.id }),
      status: 'PAUSED'
    });
    
    console.log('Ad created:', JSON.stringify(ad));
    
    return { creative_id: creative.id, ad_id: ad.id };
  } catch (e) {
    console.error(e);
  }
}

createRetargetingAd();
