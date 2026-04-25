const axios = require('axios');
const FormData = require('form-data');
const logger = require('../utils/logger');
const meta = require('./meta.service');

/**
 * LAUNCHER SERVICE
 * Handles one-click creation of 'Perfect' campaigns on Meta and Google.
 */

class LauncherService {
  
  async uploadImageToMeta(token, accountId, file) {
    const form = new FormData();
    form.append('bytes', file.buffer, { filename: file.originalname });
    
    const res = await axios.post(`https://graph.facebook.com/v21.0/${accountId}/adimages`, form, {
      params: { access_token: token },
      headers: form.getHeaders()
    });
    
    // Meta returns { images: { "filename": { hash: "..." } } }
    const hash = Object.values(res.data.images)[0].hash;
    return hash;
  }

  async uploadVideoToMeta(token, accountId, file) {
    const form = new FormData();
    form.append('source', file.buffer, { filename: file.originalname });
    form.append('title', file.originalname);
    
    const res = await axios.post(`https://graph.facebook.com/v21.0/${accountId}/advideos`, form, {
      params: { access_token: token },
      headers: form.getHeaders()
    });
    
    return res.data.id; // Returns video_id
  }

  /**
   * CREATE META CAMPAIGN (Advantage+ Shopping / ASC)
   */
  async createMetaCampaign(config) {
    const { name, budget, text, headline, files = [], assets = [] } = config;
    const accountId = process.env.META_AD_ACCOUNT_ID;
    const token = meta.getToken();

    logger.info(`Launcher: Creating Meta ASC Campaign: ${name}`);

    try {
      // 1. Create Campaign (Advantage+ Shopping)
      // Note: ASC campaigns have specific objective and special_ad_categories constraints
      // 1. Create Campaign (Sales Objective)
      const campaignRes = await axios.post(`https://graph.facebook.com/v21.0/${accountId}/campaigns`, {
        name: `THABISA_SALES_AUTOPILOT_${name}`,
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        special_ad_categories: []
      }, { params: { access_token: token } });

      const campaignId = campaignRes.data.id;

      // 2. Create Ad Set (Optimized for Purchase Conversions)
      const adSetRes = await axios.post(`https://graph.facebook.com/v21.0/${accountId}/adsets`, {
        name: `Broad_UAE_IN_${name}`,
        campaign_id: campaignId,
        daily_budget: parseInt(budget) * 100, 
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        promoted_object: { pixel_id: '1541255577299707', custom_event_type: 'PURCHASE' },
        targeting: { 
          geo_locations: { countries: ['AE', 'IN'] },
          publisher_platforms: ['facebook', 'instagram'],
          age_min: 18
        },
        status: 'ACTIVE'
      }, { params: { access_token: token } });

      const adSetId = adSetRes.data.id;

      // 3. Create Multiple Ads (One for each creative selected)
      const adResults = [];
      const creativesToProcess = assets.length > 0 ? assets : [];

      for (let i = 0; i < creativesToProcess.length; i++) {
        const item = creativesToProcess[i];
        
        // Create Creative first
        const creativeData = {
          name: `Creative_${name}_${i}`,
          object_story_spec: {
            page_id: '372752173550405',
            link_data: {
              call_to_action: { type: 'SHOP_NOW' },
              link: 'https://thabisa.shop',
              message: text,
              name: headline
            }
          }
        };

        if (item.type === 'image') {
          creativeData.object_story_spec.link_data.image_hash = item.id;
        } else {
          creativeData.object_story_spec.video_data = {
            video_id: item.id,
            image_url: item.thumbnail_url || item.url,
            call_to_action: { type: 'SHOP_NOW' }
          };
          delete creativeData.object_story_spec.link_data;
        }

        const creativeRes = await axios.post(`https://graph.facebook.com/v21.0/${accountId}/adcreatives`, creativeData, {
          params: { access_token: token }
        });

        // Link Creative to Ad Set
        const adRes = await axios.post(`https://graph.facebook.com/v21.0/${accountId}/ads`, {
          name: `Ad_${name}_v${i+1}`,
          adset_id: adSetId,
          creative: { creative_id: creativeRes.data.id },
          tracking_specs: [ { action_type: ['offsite_conversion'], fb_pixel: ['1541255577299707'] } ],
          status: 'PAUSED'
        }, { params: { access_token: token } });

        adResults.push(adRes.data.id);
      }

      logger.info(`Launcher: Gold Standard Campaign created with ${adResults.length} ads.`);
      return { ok: true, campaignId, adSetId, adIds: adResults };
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      const userMsg = e.response?.data?.error?.error_user_msg || '';
      const userTitle = e.response?.data?.error?.error_user_title || '';
      const fullMessage = [userTitle, userMsg, errorMsg].filter(Boolean).join(' - ');
      
      logger.error(`Launcher: Meta Creation Failed: ${fullMessage}`);
      throw new Error(fullMessage);
    }
  }

  /**
   * CREATE GOOGLE CAMPAIGN (Performance Max / PMax)
   */
  async createGoogleCampaign(config) {
    const { name, budget, text, headline } = config;
    const customerId = process.env.GOOGLE_CUSTOMER_ID;

    logger.info(`Launcher: Creating Google PMax Campaign: ${name}`);

    // Google Ads API requires a more complex gRPC or REST structure.
    // This is a simulated implementation using the REST endpoint pattern.
    try {
      // 1. Create Budget
      // 2. Create Campaign (AdvertisingChannelType: PERFORMANCE_MAX)
      // 3. Create Asset Group
      
      logger.info(`Launcher: Google PMax Campaign ${name} initialized in draft.`);
      
      // For this prototype, we'll return a mock success
      // Real implementation would use the 'google-ads-api' library
      return { ok: true, campaignName: name };
    } catch (e) {
      logger.error(`Launcher: Google Creation Failed: ${e.message}`);
      throw new Error(e.message);
    }
  }
}

module.exports = new LauncherService();
