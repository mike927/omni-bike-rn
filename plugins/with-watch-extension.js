const { createRunOncePlugin, withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-watch-extension';

const HEALTHKIT_ENTITLEMENT = 'com.apple.developer.healthkit';

const HEALTH_SHARE_KEY = 'NSHealthShareUsageDescription';
const HEALTH_UPDATE_KEY = 'NSHealthUpdateUsageDescription';
const HEALTH_USAGE_MESSAGE =
  'Omni Bike reads your heart rate from Apple Watch to display live HR during training sessions.';

/**
 * Adds the HealthKit entitlement and Info.plist usage strings required for
 * distributing a watchOS companion app that uses HKWorkoutSession.
 *
 * Does NOT touch the Xcode project file — the Watch app target is added
 * manually in Xcode and committed to git (Option B / partial-commit strategy).
 * See AGENTS.md § "Native iOS Constraints" for the `expo prebuild --clean` warning.
 */
const withWatchExtension = (config) => {
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults[HEALTHKIT_ENTITLEMENT] = true;
    return mod;
  });

  config = withInfoPlist(config, (mod) => {
    if (!mod.modResults[HEALTH_SHARE_KEY]) {
      mod.modResults[HEALTH_SHARE_KEY] = HEALTH_USAGE_MESSAGE;
    }
    if (!mod.modResults[HEALTH_UPDATE_KEY]) {
      mod.modResults[HEALTH_UPDATE_KEY] = HEALTH_USAGE_MESSAGE;
    }
    return mod;
  });

  return config;
};

module.exports = createRunOncePlugin(withWatchExtension, PLUGIN_NAME, '1.0.0');
