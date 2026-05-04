const { execSync } = require('child_process');

function setEnv(name, value) {
  try {
    console.log(`Setting ${name}...`);
    // Remove if exists
    try { execSync(`vercel env rm ${name} production -y`, { stdio: 'inherit' }); } catch(e) {}
    // Add new
    execSync(`echo ${value}| vercel env add ${name} production`, { input: value, stdio: 'pipe' });
    console.log(`${name} set successfully.`);
  } catch (e) {
    console.error(`Failed to set ${name}:`, e.message);
  }
}

require('dotenv').config();

setEnv('META_ACCESS_TOKEN', process.env.META_ACCESS_TOKEN);
setEnv('META_PAGE_ID', '372752173550405');
setEnv('META_PIXEL_ID', '2089219804702392');
setEnv('META_AD_ACCOUNT_ID', 'act_2285838831476206');
