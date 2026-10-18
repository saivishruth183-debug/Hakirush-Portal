// Extends app.json. Local emulator test builds (HAKIRUSH_LOCAL_TEST_BUILD=1) may talk to a
// backend on the developer machine over http (10.0.2.2), so only those builds enable Android
// cleartext traffic. Preview/production builds never set this flag and stay HTTPS-only.
module.exports = ({ config }) => {
  const localTest = process.env.HAKIRUSH_LOCAL_TEST_BUILD === '1';
  const plugins = [...(config.plugins ?? [])];
  plugins.push([
    'expo-build-properties',
    { android: { usesCleartextTraffic: localTest } },
  ]);
  return { ...config, plugins };
};
