const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');
const meta = require('./meta.service');

const PIXEL_ID = '2089219804702392';
const PAGE_ID = '372752173550405';
const INSTAGRAM_ID = '17841408447309607';

class LauncherService {
  
  async createMetaCampaign(config) {
    const { productName, budget, primaryText, headline, assets = [] } = config;
    const accountId = process.env.META_AD_ACCOUNT_ID || 'act_2285838831476206';

    logger.info(`Launcher: Starting Meta Launch for ${productName}`);

    try {
      // 1. Create Campaign (CBO)
      const campaign = await meta.apiPost(`/${accountId}/campaigns`, {
        name: `AUTOPILOT_SALES_${productName}_${new Date().toISOString().split('T')[0]}`,
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        daily_budget: parseInt(budget) * 100,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        special_ad_categories: '[]'
      });

      // 2. Create Ad Set
      const adSet = await meta.apiPost(`/${accountId}/adsets`, {
        name: `Ad Set - Broad - ${productName}`,
        campaign_id: campaign.id,
        optimization_goal: 'OFFSITE_CONVERSIONS',
        billing_event: 'IMPRESSIONS',
        promoted_object: JSON.stringify({
          pixel_id: PIXEL_ID,
          custom_event_type: 'PURCHASE'
        }),
        targeting: JSON.stringify({ 
          geo_locations: { countries: ['AE', 'IN'] },
          publisher_platforms: ['facebook', 'instagram'],
          age_min: 18
        }),
        status: 'ACTIVE'
      });

      // 3. Create Ads
      const parsedAssets = typeof assets === 'string' ? JSON.parse(assets) : assets;
      const ads = [];

      for (let i = 0; i < parsedAssets.length; i++) {
        const item = parsedAssets[i];
        
        // Build Creative according to the "Beach Ad" Gold Standard
        const creativeData = {
          page_id: PAGE_ID,
          instagram_user_id: INSTAGRAM_ID
        };

        const landingUrl = item.link || 'https://thabisa.shop/';

        if (item.type === 'video') {
          creativeData.video_data = {
            video_id: item.id,
            image_hash: 'f6fe5dbb55cc29774850b5b48a8e1f8c', // Using the confirmed valid thumbnail hash
            call_to_action: {
              type: 'SHOP_NOW',
              value: { link: landingUrl }
            },
            message: primaryText,
            title: headline
          };
        } else {
          creativeData.link_data = {
            image_hash: item.id,
            call_to_action: { type: 'SHOP_NOW' },
            link: landingUrl,
            message: primaryText,
            name: headline
          };
        }

        const creative = await meta.apiPost(`/${accountId}/adcreatives`, {
          name: `Creative - ${productName} - ${i}`,
          object_story_spec: JSON.stringify(creativeData)
        });
        
        const ad = await meta.apiPost(`/${accountId}/ads`, {
          name: `Ad - ${productName} - ${i}`,
          adset_id: adSet.id,
          creative: JSON.stringify({ creative_id: creative.id }),
          status: 'ACTIVE'
        });

        ads.push(ad.id);
      }

      return {
        success: true,
        campaign_id: campaign.id,
        adset_id: adSet.id,
        ads
      };

    } catch (error) {
      logger.error(`Launcher: Meta Creation Failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new LauncherService();
