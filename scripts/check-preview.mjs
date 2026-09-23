import { deploymentConfig } from '../src/game/deployment-policy.ts';
import { checkPreviewEndpoints } from './preview-preflight.mjs';
const config = deploymentConfig({ mode: process.env.EXPO_PUBLIC_APP_MODE,
  apiUrl: process.env.EXPO_PUBLIC_API_URL, identityOrigin: process.env.EXPO_PUBLIC_IDENTITY_ORIGIN }, false);
if (config.mode !== 'server-preview') throw new Error('Set EXPO_PUBLIC_APP_MODE=server-preview for an external server test build.');
if (process.argv.includes('--live')) {
  await checkPreviewEndpoints(config);
  console.log('Preview HTTPS API and wallet identity icon responded correctly. This does NOT prove signing, persistence or APK readiness.');
} else console.log('Preview URL syntax valid. Run with --live after deployment to check the HTTPS API and wallet identity icon.');
