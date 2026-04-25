const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Configure this in Vercel/Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_PORT === '465', 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendAlert(level, message, data = {}) {
  const recipient = process.env.ALERT_EMAIL;
  if (!recipient || !process.env.SMTP_USER) {
    logger.warn('Email alerts skipped: SMTP_USER or ALERT_EMAIL not configured');
    return;
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
    await transporter.sendMail({
      from: `"Thabisa Autopilot" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject,
      html
    });
    logger.info(`Email alert sent to ${recipient}: ${subject}`);
  } catch (err) {
    logger.error('Failed to send email alert:', err.message);
  }
}

module.exports = { sendAlert };
