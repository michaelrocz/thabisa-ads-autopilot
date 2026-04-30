const gs = require('./server/services/google.service');
require('dotenv').config({ path: '.env.local' }); // Load from .env.local

async function checkTargeting() {
  try {
    const customer = gs.getCustomer();
    console.log('--- GOOGLE ADS TARGETING ANALYSIS ---');

    // 1. Check Keywords
    console.log('\n[KEYWORDS]');
    const keywords = await customer.query(`
      SELECT 
        campaign.name, 
        ad_group.name, 
        ad_group_criterion.keyword.text, 
        ad_group_criterion.keyword.match_type,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions
      FROM ad_group_criterion
      WHERE ad_group_criterion.type = 'KEYWORD'
        AND campaign.status != 'REMOVED'
      LIMIT 100
    `);
    
    if (keywords && keywords.length > 0) {
      console.table(keywords.map(r => ({
        Campaign: r.campaign?.name || 'N/A',
        AdGroup: r.ad_group?.name || 'N/A',
        Keyword: r.ad_group_criterion?.keyword?.text || 'N/A',
        Match: r.ad_group_criterion?.keyword?.match_type || 'N/A',
        Imps: r.metrics?.impressions || 0,
        Clicks: r.metrics?.clicks || 0,
        Convs: r.metrics?.conversions || 0
      })));
    } else {
      console.log('No keyword criteria found.');
    }

    // 2. Check Locations
    console.log('\n[LOCATIONS]');
    const locations = await customer.query(`
      SELECT 
        campaign.name,
        campaign_criterion.location.geo_target_constant,
        campaign_criterion.bid_modifier
      FROM campaign_criterion
      WHERE campaign_criterion.type = 'LOCATION'
      LIMIT 20
    `);
    console.log(JSON.stringify(locations, null, 2));

  } catch (e) {
    console.error('Error checking targeting:', e);
  }
}

checkTargeting();
