# 🛠️ Thabisa Ads Autopilot: Restore & Recovery Guide

This guide ensures you can recreate this entire automation system on a new machine or a fresh Vercel account in under 10 minutes.

## 1. Prerequisites
- **Node.js** (v18+)
- **Vercel CLI** (`npm i -g vercel`)
- **GitHub Account** (where your code is hosted)

## 2. Restoring the Code
1. Clone the repository: `git clone [YOUR_GITHUB_URL]`
2. Install dependencies: `npm install`

## 3. Environment Variables (CRITICAL)
You MUST set these up in your Vercel Project Settings (or a local `.env` file) for the autopilot to work. 

| Variable | Description |
| :--- | :--- |
| `META_ACCESS_TOKEN` | Permanent System User Token from Meta Events Manager. |
| `META_AD_ACCOUNT_ID` | Your Meta Ad Account ID (format: `act_...`). |
| `META_PIXEL_ID` | Your Meta Pixel ID for tracking. |
| `GOOGLE_CUSTOMER_ID` | Your Google Ads Customer ID (format: `xxx-xxx-xxxx`). |
| `GOOGLE_DEVELOPER_TOKEN` | Your Google Ads API Developer Token. |
| `SMTP_USER` | `alhabibservice89@gmail.com` |
| `SMTP_PASS` | `Rich@2026$` |
| `ALERT_RECIPIENT` | `doproperseo@gmail.com` |

## 4. Redeploying
Once the variables are set, run:
```bash
vercel --prod
```

## 5. Verifying the Restoration
- Visit `/api/meta/test` to check the Meta connection.
- Check the Dashboard to ensure live data is flowing.
- Check Vercel "Crons" tab to ensure the hourly audits are active.

---
**Backup Generated on: 2026-04-25**
