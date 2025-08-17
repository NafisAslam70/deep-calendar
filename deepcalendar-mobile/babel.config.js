module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // ⚠️ Remove: plugins: ['expo-router/babel']
    // If you use Reanimated, keep this plugin as the LAST item:
    // plugins: ['react-native-reanimated/plugin'],
  };
};
