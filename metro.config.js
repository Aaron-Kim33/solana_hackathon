const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Preserve Expo defaults; Ogg is a bundled audio asset, not JavaScript source.
if (!config.resolver.assetExts.includes('ogg')) config.resolver.assetExts.push('ogg');
module.exports = config;
