import { deploymentConfig } from './game/deployment-policy';

// Expo replaces these exact EXPO_PUBLIC expressions in the bundle. Never put secrets here.
function loadDeployment() {
  try {
    return { config: deploymentConfig({ mode: process.env.EXPO_PUBLIC_APP_MODE,
      apiUrl: process.env.EXPO_PUBLIC_API_URL, identityOrigin: process.env.EXPO_PUBLIC_IDENTITY_ORIGIN }, __DEV__), error: false };
  } catch { return { config: null, error: true }; }
}
export const deployment = loadDeployment();
