const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Configure this in Vercel/Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, 
  auth: {
    user: 'doproperseo@gmail.com',
    pass: 'ltof omxy ajdt moyq'
  }
});

const ALERT_EMAIL = 'doproperseo@gmail.com';
const SMTP_USER = 'doproperseo@gmail.com';

async function sendAlert(level, message, data = {}) {
  const recipient = ALERT_EMAIL;
  if (!recipient || !SMTP_USER) {
    const reason = !recipient ? 'ALERT_EMAIL missing' : 'SMTP_USER missing';
    logger.warn(`Email alerts skipped: ${reason}`);
    return { ok: false, skipped: true, reason };
  }

  const subject = `[THABISA AUTOPILOT] ${level}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h2 style="color: ${level === 'CRITICAL' ? '#EF4444' : '#D4A84B'};">${level} Alert</h2>
      <p style="font-size: 1.1rem; color: #333;">${message}</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
        <pre style="font-size: 0.8rem; color: #666;">${JSON.stringify(data, null, 2)}</pre>
      </div>
      <p style="font-size: 0.8rem; color: #999; margin-top: 20px;">
        This is an automated message from your Thabisa Ads Autopilot.<br>
        <a href="https://thabisa-ads-autopilot.vercel.app" style="color: #D4A84B; text-decoration: none;">View Dashboard</a>
      </p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Thabisa Autopilot" <${SMTP_USER}>`,
      to: recipient,
      subject,
      html
    });
    logger.info(`Email alert sent to ${recipient}: ${subject}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    logger.error('Failed to send email alert:', err.message);
    return { ok: false, error: err.message };
  }
}

async function sendSummary(result) {
  const recipient = ALERT_EMAIL;
  if (!recipient || !SMTP_USER) return;

  const meta = result.meta || {};
  const google = result.google || {};
  const totalSpend = (parseFloat(meta.summary?.total_spend || 0) + parseFloat(google.total_spend || 0)).toFixed(2);
  const blendedRoas = result.blended_roas ? result.blended_roas.toFixed(2) : 'N/A';

  const subject = `[THABISA SUMMARY] Performance Report: ${new Date().toLocaleDateString()}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px; color: #333;">
      <h2 style="color: #D4A84B; border-bottom: 2px solid #D4A84B; padding-bottom: 10px;">Daily Ad Summary</h2>
      
      <div style="display: flex; justify-content: space-between; margin: 20px 0; background: #fdfdfd; padding: 15px; border-radius: 8px; border: 1px solid #f0f0f0;">
        <div style="text-align: center; flex: 1;">
          <p style="margin: 0; color: #666; font-size: 0.8rem;">TOTAL SPEND</p>
          <p style="margin: 5px 0 0; font-size: 1.2rem; font-weight: bold;">₹${totalSpend}</p>
        </div>
        <div style="text-align: center; flex: 1; border-left: 1px solid #eee;">
          <p style="margin: 0; color: #666; font-size: 0.8rem;">BLENDED ROAS</p>
          <p style="margin: 5px 0 0; font-size: 1.2rem; font-weight: bold; color: #059669;">${blendedRoas}x</p>
        </div>
      </div>

      <h3 style="font-size: 1rem; color: #666; margin-top: 30px;">Meta Performance</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <tr><td style="padding: 8px 0; color: #666;">Spend</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">₹${meta.summary?.total_spend || 0}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">ROAS</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${meta.summary?.blended_roas || 0}x</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Actions</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #D4A84B;">${meta.actions?.length || 0} taken</td></tr>
      </table>

      <h3 style="font-size: 1rem; color: #666; margin-top: 20px;">Google Performance</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <tr><td style="padding: 8px 0; color: #666;">Spend</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">₹${google.total_spend || 0}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">ROAS</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${google.blended_roas || 0}x</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Actions</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: #D4A84B;">${google.actions?.length || 0} taken</td></tr>
      </table>

      <p style="margin-top: 30px; font-size: 0.85rem; color: #666; line-height: 1.5;">
        The Autopilot is currently monitoring <b>${(meta.summary?.campaigns_audited || 0) + (google.active_campaigns || 0)}</b> active campaigns. 
        All scaling and safety triggers are active.
      </p>

      <div style="text-align: center; margin-top: 40px;">
        <a href="https://thabisa-ads-autopilot.vercel.app" style="background: #D4A84B; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold;">Open Dashboard</a>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Thabisa Autopilot" <${SMTP_USER}>`,
      to: recipient,
      subject,
      html
    });
    logger.info(`Daily summary email sent to ${recipient}`);
  } catch (err) {
    logger.error('Failed to send summary email:', err.message);
  }
}

async function sendHourlyUpdate(data) {
  const recipient = ALERT_EMAIL;
  if (!recipient || !SMTP_USER) return;

  const subject = `[THABISA HOURLY] Performance Update: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px; color: #333;">
      <h2 style="color: #D4A84B; border-bottom: 2px solid #D4A84B; padding-bottom: 10px;">Hourly Performance Heartbeat</h2>
      
      <div style="display: flex; gap: 10px; margin: 20px 0;">
        <div style="flex: 1; background: #fdfdfd; padding: 15px; border-radius: 8px; border: 1px solid #f0f0f0; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 0.8rem;">SPEND SINCE LAUNCH</p>
          <p style="margin: 5px 0 0; font-size: 1.2rem; font-weight: bold;">₹${data.total_spend_today || 0}</p>
        </div>
        <div style="flex: 1; background: #fdfdfd; padding: 15px; border-radius: 8px; border: 1px solid #f0f0f0; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 0.8rem;">CONVERSIONS</p>
          <p style="margin: 5px 0 0; font-size: 1.2rem; font-weight: bold; color: #D4A84B;">${data.total_purchases || 0}</p>
        </div>
      </div>

      <h3 style="font-size: 1rem; color: #666;">Active Campaigns Health</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
        <tr style="background: #f9f9f9;">
          <th style="padding: 10px; text-align: left;">Campaign</th>
          <th style="padding: 10px; text-align: center;">Status</th>
          <th style="padding: 10px; text-align: right;">ROAS</th>
        </tr>
        ${data.campaigns.map(c => `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">${c.name}</td>
            <td style="padding: 10px; text-align: center;"><span style="color: #059669;">● Active</span></td>
            <td style="padding: 10px; text-align: right; font-weight: bold;">${c.roas}x</td>
          </tr>
        `).join('')}
      </table>

      <p style="margin-top: 30px; font-size: 0.8rem; color: #999;">
        Algorithm Status: <b>Survival Mode V3</b> is healthy and active. Next audit in 1 hour.
      </p>

      <div style="text-align: center; margin-top: 30px;">
        <a href="https://thabisa.rockany-rky.com" style="background: #D4A84B; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 0.9rem; font-weight: bold;">View Real-Time Dashboard</a>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Thabisa Autopilot" <${SMTP_USER}>`,
      to: recipient,
      subject,
      html
    });
    logger.info(`Hourly update email sent to ${recipient}`);
  } catch (err) {
    logger.error('Failed to send hourly update email:', err.message);
  }
}

module.exports = { sendAlert, sendSummary, sendHourlyUpdate };

