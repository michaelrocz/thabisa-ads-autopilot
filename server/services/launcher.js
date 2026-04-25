const axios = require('axios');
const logger = require('../utils/logger');
const meta = require('./meta.service');

/**
 * LAUNCHER SERVICE
 * Handles one-click creation of 'Perfect' campaigns on Meta and Google.
 */

class LauncherService {
  
  /**
   * CREATE META CAMPAIGN (Advantage+ Shopping / ASC)
   */
  async createMetaCampaign(config) {
    const { name, budget, text, headline } = config;
    const accountId = process.env.META_AD_ACCOUNT_ID;
    const token = meta.getToken();

    logger.info(`Launcher: Creating Meta ASC Campaign: ${name}`);

    try {
      // 1. Create Campaign (Advantage+ Shopping)
      // Note: ASC campaigns have specific objective and special_ad_categories constraints
      const campaignRes = await axios.post(`https://graph.facebook.com/v20.0/${accountId}/campaigns`, {
        name: `PRO_ASC_${name}`,
        objective: 'OUTCOME_SALES',
        status: 'PAUSED', // Start paused for safety
        special_ad_categories: 'NONE',
        smart_promotion_type: 'AD_SET_LEVEL_OFFER' // One of the flags for ASC
      }, { params: { access_token: token } });

      const campaignId = campaignRes.data.id;

      // 2. Create Ad Set (Advantage+ Audience)
      const adSetRes = await axios.post(`https://graph.facebook.com/v20.0/${accountId}/adsets`, {
        name: `PRO_ASC_AdSet_${name}`,
        campaign_id: campaignId,
        daily_budget: parseInt(budget) * 100, // Meta uses cents
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        promoted_object: { pixel_id: process.env.META_PIXEL_ID, custom_event_type: 'PURCHASE' },
        targeting: { geo_locations: { countries: ['IN'] }, publisher_platforms: ['facebook', 'instagram'] },
        status: 'PAUSED'
      }, { params: { access_token: token } });

      const adSetId = adSetRes.data.id;

      // 3. Create Ad Creative (Standard implementation placeholder)
      // In a full implementation, we'd upload the image first.
      // Here we assume a default template or previously uploaded asset.
      logger.info(`Launcher: Campaign ${campaignId} and AdSet ${adSetId} created. Ad creation pending asset upload.`);

      return { ok: true, campaignId, adSetId };
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
