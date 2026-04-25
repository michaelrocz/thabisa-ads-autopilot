# Thabisa Shop — 3× ROAS Ads Autopilot

Autonomous AI-powered ad management dashboard for Google Ads and Meta Ads.
Targets 3× ROAS across all campaigns for Thabisa Shop (premium lifestyle brand).

## Features
- Live Meta Marketing API integration
- Live Google Ads API integration  
- Autopilot rules engine (Scale / Pause / Alert / Refresh triggers)
- Cron-based monitoring (24h, 3-day, 7-day, 14-day cadence)
- Premium dark dashboard UI

## Setup

### 1. Clone and install
```bash
git clone <repo>
cd ads/server
npm install
```

### 2. Configure environment
```bash
cp server/.env.example server/.env
# Fill in all values in server/.env
```

### 3. Run locally
```bash
node server/index.js
```

### 4. Deploy to Railway
- Connect this repo in [railway.app](https://railway.app)
- Set all environment variables from `.env.example` in Railway dashboard
- Deploy — Railway auto-runs `npm start`

## Environment Variables

| Variable | Description |
|---|---|
| `META_ACCESS_TOKEN` | Meta system user access token |
| `META_AD_ACCOUNT_ID` | Format: `act_XXXXXXXX` |
| `GOOGLE_DEVELOPER_TOKEN` | From Google Ads API Centre |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth Client Secret |
| `GOOGLE_REFRESH_TOKEN` | Generated via `/auth/google` OAuth flow |
| `GOOGLE_CUSTOMER_ID` | 10-digit Google Ads account number |
| `TARGET_ROAS` | Target ROAS (default: 3.0) |
| `TARGET_CPP` | Max cost per purchase in INR |
| `DRY_RUN` | `true` = log only, `false` = make live changes |

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/meta/summary` | Live Meta campaign summary |
| `GET /api/google/summary` | Live Google Ads summary |
| `POST /api/actions/audit` | Trigger full autopilot audit now |
| `GET /api/actions/alerts` | Get all autopilot alerts |
| `GET /api/actions/logs` | View action log |
| `GET /auth/google` | Start Google OAuth flow |
