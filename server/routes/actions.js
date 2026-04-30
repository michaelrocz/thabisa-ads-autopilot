// ── ACTIONS / AUDIT ROUTES ────────────────────────────────────
const express = require('express');
const router = express.Router();
const rulesEngine = require('../services/rules.engine');
const scheduler = require('../services/scheduler');
const meta = require('../services/meta.service');
const google = require('../services/google.service');
const launcher = require('../services/launcher');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for videos
});

// --- SURVIVAL MODE ---
router.get('/survival', async (req, res) => {
  try {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    log('--- EXECUTING SURVIVAL MODE ---');

    // 1. META CAMPAIGNS
    log('Processing Meta Campaigns...');
    const metaCampaigns = await meta.getCampaigns();
    
    const metaKeep = [
      'AUTOPILOT_RETARGETING_2026-04-29',
      'AUTOPILOT_SALES_Gold_Standard_Pets_Collection_2026-04-25',
      'AUTOPILOT_SALES_Gold_Standard_Table_Runners_2026-04-25',
      'AUTOPILOT_SALES_Gold_Standard_Nursing_Pillow_2026-04-25'
    ];

    for (const c of metaCampaigns) {
      if (c.status === 'ACTIVE') {
        if (!metaKeep.includes(c.name)) {
          log(`PAUSING META: ${c.name}`);
          const axios = require('axios');
          try {
             await axios.post(`https://graph.facebook.com/v21.0/${c.id}?access_token=${meta.getToken()}`, { status: 'PAUSED' });
          } catch(e) { log('Failed to pause Meta: ' + c.name); }
        } else {
          const newBudget = c.name.includes('RETARGETING') ? 15000 : 17500;
          log(`UPDATING BUDGET META: ${c.name} to ₹${newBudget/100}/day`);
          const axios = require('axios');
          try {
             await axios.post(`https://graph.facebook.com/v21.0/${c.id}?access_token=${meta.getToken()}`, { daily_budget: newBudget });
          } catch(e) { log('Failed to update budget Meta: ' + c.name); }
        }
      }
    }

    // 2. GOOGLE CAMPAIGNS
    log('\nProcessing Google Campaigns...');
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
       log('Google token not found in env.');
    } else {
      try {
        const googleCampaigns = await google.getCampaigns();
        const googleKeep = ['Remarketing Cart-Display', 'Hammam'];

        for (const targetName of googleKeep) {
          const c = googleCampaigns.find(comp => comp.name === targetName);
          if (c) {
            log(`Found Google Campaign: ${targetName} (ID: ${c.id}, Status: ${c.status}, Budget Resource: ${c.budget_resource_name})`);
            
            // Activate if paused
            if (c.status !== 2) {
              log(`ACTIVATING GOOGLE: ${targetName}`);
              try {
                await google.enableCampaign(c.id, 'Survival Mode Activation');
                log(`Successfully activated ${targetName}`);
              } catch(e) { 
                log(`Failed to activate Google ${targetName}: ${e.message || e}`); 
              }
            }

            // Update budget
            const newBudgetMicros = targetName === 'Hammam' ? 175000000 : 150000000;
            log(`UPDATING BUDGET GOOGLE: ${targetName} to ₹${newBudgetMicros/1000000}/day`);
            if (c.budget_resource_name) {
              try {
                const customer = google.getCustomer();
                await customer.campaignBudgets.update([{
                  resource_name: c.budget_resource_name,
                  amount_micros: newBudgetMicros
                }]);
                log(`Successfully updated budget for ${targetName}`);
              } catch(e) { 
                log(`Failed to update budget Google ${targetName}: ${e.message || JSON.stringify(e)}`);
              }
            } else {
              log(`No budget resource name found for ${targetName}`);
            }
          } else {
            log(`Google Campaign NOT FOUND: ${targetName}`);
          }
        }

        // Pause others
        for (const c of googleCampaigns) {
          if (c.status === 2 && !googleKeep.includes(c.name)) {
            log(`PAUSING GOOGLE: ${c.name}`);
            try { await google.pauseCampaign(c.id, 'Survival Mode Restructure'); }
            catch(e) { log(`Failed to pause Google ${c.name}: ${e.message || e}`); }
          }
        }
      } catch (err) {
        log(`General Google processing error: ${err.message || err}`);
      }
    }

    log('\n--- SURVIVAL MODE EXECUTION COMPLETE ---');
    res.status(200).json({ success: true, logs });
  } catch (error) {
    console.error('Survival mode API failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- CONSOLIDATION MODE ---
router.get('/consolidate', async (req, res) => {
  try {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };
    const axios = require('axios');

    log('--- EXECUTING CONSOLIDATION ---');

    // 1. Gather Creatives and Promoted Object
    const metaCampaigns = await meta.getCampaigns();
    const relevantCamps = metaCampaigns.filter(c => c.name.includes('Gold_Standard'));
    const creatives = [];
    let promotedObject = null;

    for (const c of relevantCamps) {
      // Get Creatives
      const adsRes = await axios.get(`https://graph.facebook.com/v21.0/${c.id}/ads?access_token=${meta.getToken()}&fields=id,name,creative{id}`);
      adsRes.data.data.forEach(ad => {
        creatives.push({ name: ad.name, creative_id: ad.creative.id });
        log(`Found Creative: ${ad.name} (${ad.creative.id})`);
      });
      
      // Get Promoted Object from first adset if missing
      if (!promotedObject) {
         const adsetsRes = await axios.get(`https://graph.facebook.com/v21.0/${c.id}/adsets?access_token=${meta.getToken()}&fields=promoted_object`);
         if (adsetsRes.data.data[0]?.promoted_object) {
            promotedObject = adsetsRes.data.data[0].promoted_object;
            log(`Auto-detected Promoted Object: ${JSON.stringify(promotedObject)}`);
         }
      }
    }

    if (creatives.length === 0) throw new Error('No creatives found to consolidate');
    if (!promotedObject) throw new Error('Could not find a valid Promoted Object');

    // 2. Create New Consolidated Campaign
    log('Creating Consolidated Campaign...');
    const campRes = await axios.post(`https://graph.facebook.com/v21.0/act_${process.env.META_AD_ACCOUNT_ID.replace('act_', '')}/campaigns?access_token=${meta.getToken()}`, {
      name: 'AUTOPILOT_SURVIVAL_PROSPECTING_CONSOLIDATED_2026-04-30',
      objective: 'OUTCOME_SALES',
      status: 'ACTIVE',
      special_ad_categories: [],
      daily_budget: 70000 // ₹700
    });
    const campaignId = campRes.data.id;
    log(`Campaign Created: ${campaignId}`);

    // 3. Create Ad Set
    log('Creating Ad Set...');
    const adsetRes = await axios.post(`https://graph.facebook.com/v21.0/act_${process.env.META_AD_ACCOUNT_ID.replace('act_', '')}/adsets?access_token=${meta.getToken()}`, {
      name: 'Consolidated_AdSet_25-55',
      campaign_id: campaignId,
      status: 'ACTIVE',
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      bid_amount: 1000,
      targeting: {
        geo_locations: { countries: ['IN'] },
        age_min: 25,
        age_max: 55,
        publisher_platforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
        targeting_automation: { advantage_audience: 0 }
      },
      promoted_object: promotedObject
    });
    const adsetId = adsetRes.data.id;
    log(`Ad Set Created: ${adsetId}`);

    // 4. Create Ads
    for (const cr of creatives) {
      log(`Adding Ad: ${cr.name}`);
      await axios.post(`https://graph.facebook.com/v21.0/act_${process.env.META_AD_ACCOUNT_ID.replace('act_', '')}/ads?access_token=${meta.getToken()}`, {
        name: cr.name,
        adset_id: adsetId,
        creative: { creative_id: cr.creative_id },
        status: 'ACTIVE'
      });
    }

    // 5. Pause Old Ones
    log('Pausing individual product campaigns...');
    for (const c of relevantCamps) {
       await axios.post(`https://graph.facebook.com/v21.0/${c.id}?access_token=${meta.getToken()}`, { status: 'PAUSED' });
    }
    
    // Pause Google Hammam
    const googleCampaigns = await google.getCampaigns();
    const hammam = googleCampaigns.find(c => c.name === 'Hammam');
    if (hammam) {
       await google.pauseCampaign(hammam.id, 'Consolidated into Meta Survival Campaign');
    }

    log('--- CONSOLIDATION COMPLETE ---');
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message, data: e.response?.data });
  }
});

// --- BUDGET UPDATE MODE (₹10,000 TOTAL) ---
router.get('/update-budgets-10k', async (req, res) => {
  try {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };
    const axios = require('axios');

    log('--- UPDATING BUDGETS TO ₹10,000 TOTAL ---');

    // 1. META
    const metaCampaigns = await meta.getCampaigns();
    
    // Powerhouse
    const powerhouse = metaCampaigns.find(c => c.name === 'AUTOPILOT_SURVIVAL_PROSPECTING_CONSOLIDATED_2026-04-30');
    if (powerhouse) {
      log(`UPDATING POWERHOUSE META: ₹1100/day`);
      await axios.post(`https://graph.facebook.com/v21.0/${powerhouse.id}?access_token=${meta.getToken()}`, { daily_budget: 110000 });
    }

    // Retargeting
    const retargeting = metaCampaigns.find(c => c.name === 'AUTOPILOT_RETARGETING_2026-04-29');
    if (retargeting) {
      log(`UPDATING RETARGETING META: ₹164/day`);
      await axios.post(`https://graph.facebook.com/v21.0/${retargeting.id}?access_token=${meta.getToken()}`, { daily_budget: 16400 });
    }

    // 2. GOOGLE
    const googleCampaigns = await google.getCampaigns();
    const googleRem = googleCampaigns.find(c => c.name === 'Remarketing Cart-Display');
    if (googleRem && googleRem.budget_resource_name) {
      log(`UPDATING GOOGLE REMARKETING: ₹164/day`);
      const customer = google.getCustomer();
      await customer.campaignBudgets.update([{
        resource_name: googleRem.budget_resource_name,
        amount_micros: 164000000
      }]);
    }

    log('--- BUDGET UPDATE COMPLETE ---');
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message, data: e.response?.data });
  }
});

// --- MAX PERFORMANCE OPTIMIZATION ---
router.get('/optimize-for-sales', async (req, res) => {
  try {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };
    const axios = require('axios');

    log('--- OPTIMIZING FOR MAXIMUM SALES CONVERSIONS ---');

    // 1. Find the consolidated campaign
    const metaCampaigns = await meta.getCampaigns();
    const powerhouse = metaCampaigns.find(c => c.name === 'AUTOPILOT_SURVIVAL_PROSPECTING_CONSOLIDATED_2026-04-30');
    
    if (!powerhouse) throw new Error('Consolidated campaign not found');

    // 2. Get Ad Sets
    const adsetsRes = await axios.get(`https://graph.facebook.com/v21.0/${powerhouse.id}/adsets?access_token=${meta.getToken()}&fields=id,name`);
    const adset = adsetsRes.data.data[0];

    if (!adset) throw new Error('No ad set found in campaign');

    log(`Optimizing Ad Set: ${adset.name} (${adset.id})`);

    // 3. Apply FB High-Performance Recommendations
    // - Optimization: OFFSITE_CONVERSIONS (Sales)
    // - Advantage+ Audience: Enabled
    // - Advantage+ Placements: Enabled (By using publisher_platforms without specific positions)
    await axios.post(`https://graph.facebook.com/v21.0/${adset.id}?access_token=${meta.getToken()}`, {
      optimization_goal: 'OFFSITE_CONVERSIONS',
      billing_event: 'IMPRESSIONS',
      targeting: {
        geo_locations: { countries: ['IN'] },
        age_min: 25,
        age_max: 55,
        publisher_platforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
        targeting_automation: { advantage_audience: 1 } // Advantage+ Audience ON
      }
    });

    log('Applied Advantage+ Audience and Sales Optimization.');
    log('--- OPTIMIZATION COMPLETE ---');
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message, data: e.response?.data });
  }
});

// --- RELAUNCH COMPLETELY FRESH CAMPAIGN ---
router.get('/relaunch-fresh', async (req, res) => {
  try {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };
    const axios = require('axios');

    log('--- RELAUNCHING FRESH OPTIMIZED CAMPAIGN ---');

    // 1. Get existing data (Pixel, Creatives)
    const metaCampaigns = await meta.getCampaigns();
    const oldCamp = metaCampaigns.find(c => c.name.includes('CONSOLIDATED'));
    if (!oldCamp) throw new Error('Old consolidated campaign not found');

    const adsetsRes = await axios.get(`https://graph.facebook.com/v21.0/${oldCamp.id}/adsets?access_token=${meta.getToken()}&fields=id,promoted_object`);
    const oldAdSet = adsetsRes.data.data[0];
    if (!oldAdSet) throw new Error('No old ad set found');

    // 2. Create NEW Campaign
    log('Creating NEW Sales Campaign V3...');
    const campRes = await axios.post(`https://graph.facebook.com/v21.0/act_${process.env.META_AD_ACCOUNT_ID.replace('act_', '')}/campaigns?access_token=${meta.getToken()}`, {
      name: 'AUTOPILOT_SURVIVAL_SALES_OPTIMIZED_V3',
      objective: 'OUTCOME_SALES',
      status: 'ACTIVE',
      special_ad_categories: [],
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      daily_budget: 110000 // ₹1100
    });
    const newCampId = campRes.data.id;
    log(`New Campaign Created: ${newCampId}`);

    // 3. Create NEW Ad Set
    log('Creating NEW Optimized Ad Set...');
    const newAdSetRes = await axios.post(`https://graph.facebook.com/v21.0/act_${process.env.META_AD_ACCOUNT_ID.replace('act_', '')}/adsets?access_token=${meta.getToken()}`, {
      name: 'MAX_PERFORMANCE_ADSET',
      campaign_id: newCampId,
      status: 'ACTIVE',
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      targeting: {
        geo_locations: { countries: ['IN'] },
        publisher_platforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
        targeting_automation: { advantage_audience: 1 }
      },
      promoted_object: oldAdSet.promoted_object
    });
    const newAdSetId = newAdSetRes.data.id;
    log(`New Ad Set Created: ${newAdSetId}`);

    // 4. Move Ads
    const adsRes = await axios.get(`https://graph.facebook.com/v21.0/${oldAdSet.id}/ads?access_token=${meta.getToken()}&fields=id,name,creative{id}`);
    const ads = adsRes.data.data;
    
    for (const ad of ads) {
      log(`Recreating Ad: ${ad.name}`);
      await axios.post(`https://graph.facebook.com/v21.0/act_${process.env.META_AD_ACCOUNT_ID.replace('act_', '')}/ads?access_token=${meta.getToken()}`, {
        name: ad.name,
        adset_id: newAdSetId,
        creative: { creative_id: ad.creative.id },
        status: 'ACTIVE'
      });
    }

    // 5. Pause Old Campaigns
    log('Pausing OLD consolidated campaign...');
    await axios.post(`https://graph.facebook.com/v21.0/${oldCamp.id}?access_token=${meta.getToken()}`, { status: 'PAUSED' });

    log('--- FRESH RELAUNCH COMPLETE ---');
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message, data: e.response?.data });
  }
});

// --- VERIFY & REPAIR FOCUS CAMPAIGNS ---
router.get('/verify-and-repair', async (req, res) => {
  try {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };
    const axios = require('axios');

    log('--- VERIFYING FOCUS CAMPAIGNS ---');

    const metaCampaigns = await meta.getCampaigns();
    const focusMeta = [
      'AUTOPILOT_SURVIVAL_SALES_OPTIMIZED_V2',
      'AUTOPILOT_RETARGETING_2026-04-29'
    ];

    for (const name of focusMeta) {
      const camp = metaCampaigns.find(c => c.name === name);
      if (camp) {
        log(`Checking Campaign: ${name} (Status: ${camp.status})`);
        
        // 1. Activate Campaign if paused
        if (camp.status !== 'ACTIVE') {
          log(`RE-ACTIVATING CAMPAIGN: ${name}`);
          await axios.post(`https://graph.facebook.com/v21.0/${camp.id}?access_token=${meta.getToken()}`, { status: 'ACTIVE' });
        }

        // 2. Check Ad Sets
        const adsetsRes = await axios.get(`https://graph.facebook.com/v21.0/${camp.id}/adsets?access_token=${meta.getToken()}&fields=id,name,status`);
        for (const as of adsetsRes.data.data) {
          if (as.status !== 'ACTIVE') {
            log(`RE-ACTIVATING AD SET: ${as.name} (${as.id})`);
            await axios.post(`https://graph.facebook.com/v21.0/${as.id}?access_token=${meta.getToken()}`, { status: 'ACTIVE' });
          }

          // 3. Check Ads
          const adsRes = await axios.get(`https://graph.facebook.com/v21.0/${as.id}/ads?access_token=${meta.getToken()}&fields=id,name,status`);
          for (const ad of adsRes.data.data) {
            if (ad.status !== 'ACTIVE') {
              log(`RE-ACTIVATING AD: ${ad.name} (${ad.id})`);
              await axios.post(`https://graph.facebook.com/v21.0/${ad.id}?access_token=${meta.getToken()}`, { status: 'ACTIVE' });
            }
          }
        }
      } else {
        log(`WARNING: Focus Campaign NOT FOUND: ${name}`);
      }
    }

    // Google
    log('\nChecking Google Remarketing...');
    const googleCampaigns = await google.getCampaigns();
    const rem = googleCampaigns.find(c => c.name === 'Remarketing Cart-Display');
    if (rem && rem.status !== 2) {
       log(`RE-ACTIVATING GOOGLE REMARKETING: ${rem.id}`);
       await google.enableCampaign(rem.id, 'Verification Repair');
    } else if (rem) {
       log('Google Remarketing is already ACTIVE.');
    }

    log('--- VERIFICATION COMPLETE ---');
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message, data: e.response?.data });
  }
});

// GET /api/actions/refine-targeting — Refine V3 audience for high-intent buyers
router.get('/refine-targeting', async (req, res) => {
  try {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };
    
    log('--- REFINING AUDIENCE TARGETING ---');
    const campaigns = await meta.getCampaigns();
    const v3 = campaigns.find(c => c.name === 'AUTOPILOT_SURVIVAL_SALES_OPTIMIZED_V3');

    if (!v3) {
      return res.status(404).json({ success: false, error: 'V3 Campaign not found' });
    }

    const adsets = await meta.getAdSets(v3.id);
    for (const as of adsets) {
      log(`Updating Targeting for Ad Set: ${as.name}`);
      
      const newTargeting = {
        geo_locations: { countries: ['IN'] },
        age_min: 25,
        age_max: 55,
        flexible_spec: [
          {
            interests: [
              { id: '6003254924719', name: 'Luxury goods' },
              { id: '6003270428236', name: 'Online shopping' },
              { id: '6003310022236', name: 'Home decor' },
              { id: '6002714398372', name: 'Parents' }
            ]
          }
        ]
      };

      await meta.updateAdSetTargeting(as.id, newTargeting);
      log(`Successfully updated ${as.name} with High-Intent Layer.`);
    }

    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/actions/audit — run full audit now (on demand)
// GET also supported for Vercel Cron
router.all('/audit', async (req, res) => {
  try {
    const result = await rulesEngine.runFullAudit();
    scheduler.setLastAuditResult(result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.all('/test-email', async (req, res) => {
  try {
    const notifier = require('../services/notifier');
    const status = await notifier.sendAlert('INFO', 'Test Alert: Your Thabisa Ads Autopilot email system is working!', {
      test_timestamp: new Date().toISOString(),
      recipient: process.env.ALERT_EMAIL || 'Not Configured'
    });
    
    if (status.ok) {
      res.json({ ok: true, message: 'Test email sent successfully! Check your inbox.', info: status });
    } else if (status.skipped) {
      res.status(400).json({ 
        ok: false, 
        message: `Email was SKIPPED: ${status.reason}. Please add it to Vercel Environment Variables.`,
        required_vars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'ALERT_EMAIL']
      });
    } else {
      res.status(500).json({ ok: false, message: 'Email failed to send. Check your SMTP settings.', error: status.error });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/actions/audit/meta — run Meta audit only (GET for Vercel Cron)
router.all('/audit/meta', async (req, res) => {
  try { res.json(await rulesEngine.runMetaRules()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/actions/audit/google — run Google audit only
router.all('/audit/google', async (req, res) => {
  try { res.json(await rulesEngine.runGoogleRules()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/actions/last-audit — get last audit result
router.get('/last-audit', (req, res) => {
  const result = scheduler.getLastAuditResult();
  if (!result) return res.json({ message: 'No audit run yet. POST /api/actions/audit to trigger one.' });
  res.json(result);
});

// GET /api/actions/alerts — get all alerts
router.get('/alerts', (req, res) => {
  res.json(rulesEngine.getAlerts());
});

// POST /api/actions/alerts/read — mark alerts as read
router.post('/alerts/read', (req, res) => {
  rulesEngine.markAlertsRead();
  res.json({ ok: true });
});

// GET /api/actions/logs — tail the actions log file
router.get('/logs', (req, res) => {
  const logPath = path.join(__dirname, '..', 'logs', 'actions.log');
  if (!fs.existsSync(logPath)) return res.json([]);
  const lines = fs.readFileSync(logPath, 'utf8')
    .split('\n').filter(Boolean)
    .slice(-100) // last 100 entries
    .map(line => { try { return JSON.parse(line); } catch { return { raw: line }; } })
    .reverse();
  res.json(lines);
});

// GET /api/actions/status — autopilot status
router.get('/status', (req, res) => {
  res.json({
    dry_run: process.env.DRY_RUN !== 'false',
    target_roas: parseFloat(process.env.TARGET_ROAS || 3),
    target_cpp_inr: parseFloat(process.env.TARGET_CPP || 2500),
    min_spend_inr: parseFloat(process.env.MIN_SPEND_BEFORE_PAUSE || 1000),
    currency: process.env.CURRENCY || 'INR',
    meta_connected: !!process.env.META_ACCESS_TOKEN,
    meta_account_id: process.env.META_AD_ACCOUNT_ID,
    meta_page_id: process.env.META_PAGE_ID,
    google_connected: !!process.env.GOOGLE_REFRESH_TOKEN,
    last_audit: scheduler.getLastAuditResult()?.timestamp || null,
    uptime_seconds: Math.floor(process.uptime()),
    node_env: process.env.NODE_ENV
  });
});

// GET /api/actions/test-connection — test all connections
router.get('/test-connection', async (req, res) => {
  try {
    const metaRes = await meta.testConnection().catch(e => ({ ok: false, error: e.message }));
    const googleRes = await google.testConnection().catch(e => ({ ok: false, error: e.message }));
    res.json({ meta: metaRes, google: googleRes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/actions/summary — Blended Meta + Google summary
router.get('/summary', async (req, res) => {
  try {
    const [metaSummary, googleSummary] = await Promise.all([
      meta.getSummary().catch(err => ({ error: err.message, platform: 'meta' })),
      google.getSummary().catch(err => ({ error: err.message, platform: 'google' }))
    ]);

    const blended = {
      total_spend: (metaSummary.total_spend || 0) + (googleSummary.total_spend || 0),
      total_spend_today: (metaSummary.total_spend_today || 0) + (googleSummary.total_spend_today || 0),
      total_revenue: (metaSummary.total_revenue || 0) + (googleSummary.total_revenue || 0),
      active_campaigns: (metaSummary.active_campaigns || 0) + (googleSummary.active_campaigns || 0),
      platforms: {
        meta: metaSummary,
        google: googleSummary
      }
    };
    blended.blended_roas = blended.total_spend > 0 ? blended.total_revenue / blended.total_spend : 0;
    
    res.json(blended);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/actions/update-token — update Meta token dynamically
router.post('/update-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });
  
  // Update in-memory for the current process
  process.env.META_ACCESS_TOKEN = token;
  
  // Also try to update .env file if it exists (for local dev)
  try {
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('META_ACCESS_TOKEN=')) {
        content = content.replace(/META_ACCESS_TOKEN=.*/, `META_ACCESS_TOKEN=${token}`);
      } else {
        content += `\nMETA_ACCESS_TOKEN=${token}`;
      }
      fs.writeFileSync(envPath, content);
    }
  } catch (e) {
    console.error('Failed to update .env file:', e.message);
  }

  res.json({ ok: true, message: 'Meta token updated successfully for the current session.' });
});

// GET /api/actions/test-hourly — Manually trigger the hourly update
router.get('/test-hourly', async (req, res) => {
  try {
    const meta = require('../services/meta.service');
    const google = require('../services/google.service');
    const notifier = require('../services/notifier');

    const [mSummary, gSummary] = await Promise.all([
      meta.getSummary(),
      google.getSummary()
    ]);

    const baseline = 1550.73;
    const totalSpendToday = (mSummary.total_spend_today || 0) + (gSummary.total_spend_today || 0);
    const spendSinceLaunch = Math.max(0, totalSpendToday - baseline);

    const data = {
      total_spend_today: spendSinceLaunch.toFixed(2),
      total_purchases: (mSummary.total_purchases || 0) + (gSummary.total_conversions || 0),
      campaigns: [
        ...mSummary.campaigns_detail.filter(c => c.status === 'ACTIVE').map(c => ({ name: c.campaign_name, roas: c.roas })),
        ...gSummary.campaigns_detail.filter(c => c.status === 2 || c.status === 'ENABLED' || c.status === 'ACTIVE').map(c => ({ name: c.campaign_name, roas: c.roas }))
      ]
    };

    await notifier.sendHourlyUpdate(data);
    res.json({ success: true, message: 'Hourly update email triggered', data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/actions/launch-meta — One-click launch
router.post('/launch-meta', upload.array('files'), async (req, res) => {
  try {
    const config = {
      ...req.body,
      files: req.files
    };
    const result = await launcher.createMetaCampaign(config);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/actions/launch-google — One-click launch
router.post('/launch-google', async (req, res) => {
  try {
    const result = await launcher.createGoogleCampaign(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/debug-google', async (req, res) => {
  try {
    const googleService = require('../services/google.service');
    const result = await googleService.testConnection();
    const campaigns = await googleService.getCampaigns();
    const metrics = await googleService.getCampaignMetrics('THIS_MONTH');
    res.json({ ok: true, connection: result, campaigns_count: campaigns.length, metrics_count: metrics.length, campaigns });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err.message,
      stack: err.stack,
      raw: JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)))
    });
  }
});

router.get('/targeting-check', async (req, res) => {
  try {
    const googleService = require('../services/google.service');
    const customer = googleService.getCustomer();
    
    const keywords = await customer.query(`
      SELECT 
        campaign.name, 
        ad_group.name, 
        ad_group_criterion.keyword.text, 
        ad_group_criterion.keyword.match_type
      FROM ad_group_criterion
      WHERE ad_group_criterion.type = 'KEYWORD'
        AND campaign.status != 'REMOVED'
      LIMIT 100
    `);

    const locations = await customer.query(`
      SELECT 
        campaign.name,
        campaign_criterion.location.geo_target_constant
      FROM campaign_criterion
      WHERE campaign_criterion.type = 'LOCATION'
      LIMIT 20
    `);

    res.json({ ok: true, keywords, locations });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message, raw: err });
  }
});

router.get('/enable-campaign', async (req, res) => {
  try {
    const googleService = require('../services/google.service');
    const { id, reason } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing campaign id' });
    const result = await googleService.enableCampaign(id, reason || 'Manual enable via autopilot');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/update-google-bid', async (req, res) => {
  try {
    const googleService = require('../services/google.service');
    const { id, bid } = req.query;
    if (!id || !bid) return res.status(400).json({ error: 'Missing id or bid' });
    const customer = googleService.getCustomer();
    const result = await customer.adGroups.update([
      {
        resource_name: `customers/${process.env.GOOGLE_CUSTOMER_ID.replace(/-/g, '')}/adGroups/${id}`,
        cpc_bid_micros: Math.round(parseFloat(bid) * 1e6)
      }
    ]);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/update-google-match-type', async (req, res) => {
  try {
    const googleService = require('../services/google.service');
    const { adGroupId, ids, type } = req.query; // type 2=BROAD, 3=PHRASE, 4=EXACT
    if (!adGroupId || !ids || !type) return res.status(400).json({ error: 'Missing adGroupId, ids or type' });
    const customer = googleService.getCustomer();
    const cleanId = process.env.GOOGLE_CUSTOMER_ID.replace(/-/g, '');
    const updates = ids.split(',').map(id => ({
      resource_name: `customers/${cleanId}/adGroupCriteria/${adGroupId}~${id}`,
      keyword: { match_type: parseInt(type) }
    }));
    const result = await customer.adGroupCriteria.update(updates);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/create-search-campaign', async (req, res) => {
  try {
    const googleService = require('../services/google.service');
    const name = `Search_Conversion_HighIntent_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const keywords = [
      'acrylic coated aprons',
      'oekotex baby towels',
      'durable dog beds',
      'premium nursing pillows',
      'stylish beach bags india'
    ];
    const budget = 500; // ₹500/day
    
    const result = await googleService.createSearchCampaign(name, budget, keywords);
    res.json(result);
  } catch (err) {
    let errorMessage = err.message;
    let detailedErrors = [];
    
    if (err.errors && Array.isArray(err.errors)) {
      detailedErrors = err.errors.map(e => ({
        message: e.message,
        code: e.error_code,
        location: e.location
      }));
      if (detailedErrors.length > 0 && detailedErrors[0].message) {
        errorMessage = detailedErrors[0].message;
      }
    }

    res.status(500).json({ 
      ok: false, 
      message: errorMessage,
      detailed: detailedErrors,
      request_id: err.request_id,
      stack: err.stack
    });
  }
});

module.exports = router;
