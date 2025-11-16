// scripts/enable-totp.js
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// ---------------------------------------------------------------------
// Load .env (the file you just created)
// ---------------------------------------------------------------------
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ---------------------------------------------------------------------
// Grab the three env vars
// ---------------------------------------------------------------------
const projectId = process.env.FB_PROJECT_ID;
const clientEmail = process.env.FB_CLIENT_EMAIL;
let privateKey = process.env.FB_PRIVATE_KEY;

// ---------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------
if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing required env vars in .env:');
    !projectId && console.error('   FB_PROJECT_ID');
    !clientEmail && console.error('   FB_CLIENT_EMAIL');
    !privateKey && console.error('   FB_PRIVATE_KEY');
    process.exit(1);
}

// ---------------------------------------------------------------------
// Convert escaped \n → real line-breaks
// ---------------------------------------------------------------------
privateKey = privateKey.replace(/\\n/g, '\n');

const serviceAccount = { projectId, clientEmail, privateKey };
console.log('Service account object built');

// ---------------------------------------------------------------------
// Initialise Firebase Admin (once)
// ---------------------------------------------------------------------
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin initialized');
    } catch (err) {
        console.error('Failed to initialise Firebase Admin:', err.message);
        process.exit(1);
    }
}

// ---------------------------------------------------------------------
// Enable TOTP MFA
// ---------------------------------------------------------------------
async function enableTOTP() {
    try {
        console.log('\nEnabling TOTP MFA...');

        const cfg = await admin.auth().projectConfigManager().updateProjectConfig({
            multiFactorConfig: {
                state: 'ENABLED',
                providerConfigs: [
                    {
                        state: 'ENABLED',
                        totpProviderConfig: { adjacentIntervals: 5 },
                    },
                ],
            },
        });

        console.log('\nTOTP MFA ENABLED');
        console.log('\nConfig:');
        console.log(JSON.stringify(cfg.multiFactorConfig, null, 2));
        console.log('\nUsers can now enroll with Google Authenticator, Authy, etc.\n');
        process.exit(0);
    } catch (err) {
        console.error('\nError enabling TOTP:', err.message);
        if (err.code) console.error('Code:', err.code);
        process.exit(1);
    }
}

// ---------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------
console.log('Starting TOTP enablement script...\n');
enableTOTP();