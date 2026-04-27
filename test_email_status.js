const meta = require('./server/services/meta.service');
const notifier = require('./server/services/notifier');
require('dotenv').config({ path: '.env.production' });

async function sendTest() {
  try {
    console.log('Fetching live campaign status...');
    const summary = await meta.getSummary('last_7d');
    
    let statusMessage = `Your Ads Autopilot is active. Blended ROAS is currently ${summary.blended_roas}x across ${summary.active_campaigns} active campaigns.\n\n`;
    
    summary.campaigns_detail.slice(0, 5).forEach(c => {
      statusMessage += `- ${c.campaign_name}: ₹${c.spend} | ROAS: ${c.roas}x [${c.health_status}]\n`;
    });
    
    if (summary.flagged_count > 0) {
      statusMessage += `\n⚠️ Flagged Issues:\n`;
      summary.flagged.forEach(f => {
        statusMessage += `- ${f.campaign_name}: ${f.flags.join(', ')}\n`;
      });
    }

    console.log('Sending test email to:', process.env.ALERT_EMAIL);
    await notifier.sendAlert('INFO', 'TEST: Current Campaign Status Report', {
      summary: {
        total_spend: summary.total_spend,
        total_revenue: summary.total_revenue,
        blended_roas: summary.blended_roas,
        active_campaigns: summary.active_campaigns
      },
      top_campaigns: summary.campaigns_detail.slice(0, 3).map(c => ({
        name: c.campaign_name,
        spend: c.spend,
        roas: c.roas,
        health: c.health_status
      }))
    });
    
    console.log('SUCCESS: Test email sent.');
  } catch (e) {
    console.error('FAILED to send test email:', e.message);
  }
}

sendTest();
