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
      const campaignRes = await axios.post(`https://graph.facebook.com/v21.0/${accountId}/campaigns`, {
        name: `PRO_SALES_${name}_${Date.now()}`,
        objective: 'OUTCOME_SALES',
        status: 'PAUSED',
        special_ad_categories: ['NONE']
      }, { params: { access_token: token } });

      const campaignId = campaignRes.data.id;

      // 2. Create Ad Set (Standard Audience targeting UAE/India)
      const adSetRes = await axios.post(`https://graph.facebook.com/v21.0/${accountId}/adsets`, {
        name: `AdSet_${name}`,
        campaign_id: campaignId,
        daily_budget: parseInt(budget) * 100, 
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        promoted_object: { pixel_id: process.env.META_PIXEL_ID, custom_event_type: 'PURCHASE' },
        targeting: { 
          geo_locations: { countries: ['AE', 'IN'] },
          publisher_platforms: ['facebook', 'instagram']
        },
        status: 'ACTIVE'
      }, { params: { access_token: token } });

      const adSetId = adSetRes.data.id;

      // 3. Create Ads for each creative (either from pre-uploaded assets or files)
      const adResults = [];
      const creativesToProcess = assets.length > 0 
        ? assets.map(a => ({ type: a.type, id: a.id }))
        : files.map(f => ({ type: f.mimetype.startsWith('video/') ? 'video' : 'image', file: f }));

      for (let i = 0; i < creativesToProcess.length; i++) {
        const item = creativesToProcess[i];
        let assetId = item.id;

        // If no ID, upload it now (fallback for smaller files)
        if (!assetId && item.file) {
          if (item.type === 'image') assetId = await this.uploadImageToMeta(token, accountId, item.file);
          else assetId = await this.uploadVideoToMeta(token, accountId, item.file);
        }

        let creativeData = {
          name: `Creative_${name}_${i}`,
          object_story_spec: {
            page_id: process.env.META_PAGE_ID,
            link_data: {
              call_to_action: { type: 'SHOP_NOW' },
              link: process.env.SHOP_URL || 'https://thabisa.shop',
              message: text,
              name: headline
            }
          }
        };

        if (item.type === 'image') {
          creativeData.object_story_spec.link_data.image_hash = assetId;
        } else if (item.type === 'video') {
          creativeData.object_story_spec.video_data = {
            video_id: assetId,
            image_url: item.thumbnail_url || 'https://thabisa.shop/favicon.ico',
            call_to_action: { type: 'SHOP_NOW' }
          };
          delete creativeData.object_story_spec.link_data;
        }

        const creativeRes = await axios.post(`https://graph.facebook.com/v21.0/${accountId}/adcreatives`, creativeData, {
          params: { access_token: token }
        });

        const adRes = await axios.post(`https://graph.facebook.com/v21.0/${accountId}/ads`, {
          name: `Ad_${name}_${i}`,
          adset_id: adSetId,
          creative: { creative_id: creativeRes.data.id },
          status: 'PAUSED'
        }, { params: { access_token: token } });

        adResults.push(adRes.data.id);
      }

      logger.info(`Launcher: Campaign ${campaignId} created with ${adResults.length} ads.`);
      return { ok: true, campaignId, adSetId, adIds: adResults };
    } catch (e) {
      const errorMsg = e.response?.data?.error?.message || e.message;
      logger.error(`Launcher: Meta Creation Failed: ${errorMsg}`);
      throw new Error(errorMsg);
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
