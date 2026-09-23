const { expo } = require('./app.json');

// Keep the existing development/store package unchanged. Internal preview
// installs alongside it, so testing never requires deleting local saves.
module.exports = () => {
  const preview = process.env.APP_VARIANT === 'preview';
  if (process.env.APP_VARIANT && !['preview', 'production'].includes(process.env.APP_VARIANT)) {
    throw new Error('INVALID_APP_VARIANT');
  }
  if (process.env.EAS_BUILD === 'true') {
    for (const name of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_IDENTITY_ORIGIN']) {
      const value = process.env[name];
      let url;
      try { url = new URL(value); } catch { throw new Error(`MISSING_BUILD_URL: ${name}`); }
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
          !/^[a-z0-9.-]+$/i.test(url.hostname) || !url.hostname.includes('.') ||
          /(^127\.|^0\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) ||
          /(^localhost$|\.localhost$|\.local$|\.example$|\.invalid$|\.test$)/i.test(url.hostname)) {
        throw new Error(`INVALID_BUILD_URL: ${name}`);
      }
    }
  }
  return {
    ...expo,
    plugins: [...(expo.plugins || []), 'expo-secure-store'],
    name: preview ? 'Lumber Rush Preview' : expo.name,
    scheme: preview ? 'lumberrush-preview' : expo.scheme,
    icon: './assets/lumber-rush-icon-v2.png',
    android: {
      ...expo.android,
      package: preview ? 'com.lumberrush.seeker.preview' : expo.android.package,
      adaptiveIcon: {
        backgroundColor: '#0E3A37',
        foregroundImage: './assets/lumber-rush-adaptive-foreground-v2.png',
      },
    },
  };
};
