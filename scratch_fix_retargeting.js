require('dotenv').config();
const ms = require('./server/services/meta.service');

async function fixRetargeting() {
  try {
    const accountId = process.env.META_AD_ACCOUNT_ID;
    const adId = '120243685490720559';
    const pixelId = '2089219804702392';
    
    // 1. Update Creative with better structure
    console.log('Updating Creative...');
    const creative = await ms.apiPost(`/${accountId}/adcreatives`, {
      name: 'Retargeting Creative - v2',
      object_story_spec: JSON.stringify({
        page_id: '372752173550405',
        link_data: {
          link: 'https://thabisa.shop/',
          message: 'Still thinking about it? Thabisa essentials are waiting for you. Get 10% OFF your first order with code: WELCOME10 ✨',
          call_to_action: {
            type: 'SHOP_NOW',
            value: { link: 'https://thabisa.shop/' }
          },
          image_hash: 'f49ed80cbc155071cb4652812adb3a4a'
        }
      })
    });
    
    console.log('New Creative created:', creative.id);
    
    // 2. Update Ad
    console.log('Updating Ad...');
    await ms.apiPost(`/${adId}`, {
      creative: JSON.stringify({ creative_id: creative.id }),
      tracking_specs: JSON.stringify([
        {
          "action.type": ["offsite_conversion"],
          "fb_pixel": [pixelId]
        }
      ]),
      status: 'ACTIVE'
    });
    
    console.log('Retargeting Ad is now LIVE!');
  } catch (e) {
    console.error(e);
  }
}

fixRetargeting();
