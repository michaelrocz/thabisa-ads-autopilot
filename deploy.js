const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const tokenMatch = envContent.match(/VERCEL_OIDC_TOKEN="([^"]+)"/);
  
  if (!tokenMatch) {
    console.error("Could not find VERCEL_OIDC_TOKEN in .env");
    process.exit(1);
  }
  
  const token = tokenMatch[1];
  console.log("🚀 Starting Vercel Deployment...");
  
  // Use npx and pass the token directly
  execSync(`npx vercel --prod --yes --token ${token}`, { stdio: 'inherit' });
  
  console.log("✅ Deployment Successful!");
} catch (e) {
  console.error("❌ Deployment Failed:", e.message);
  process.exit(1);
}
