const { createRunOncePlugin, withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-watch-extension';

const HEALTHKIT_ENTITLEMENT = 'com.apple.developer.healthkit';

const HEALTH_SHARE_KEY = 'NSHealthShareUsageDescription';
const HEALTH_UPDATE_KEY = 'NSHealthUpdateUsageDescription';
const HEALTH_SHARE_MESSAGE =
  'Omni Bike reads your heart rate from Apple Watch to display live HR during training sessions.';
const HEALTH_UPDATE_MESSAGE =
  'Omni Bike saves your completed indoor cycling workouts (duration, distance, calories, and heart rate) to Apple Health.';

/**
 * Adds the HealthKit entitlement and Info.plist usage strings required for:
 *  - the watchOS companion app reading HR via HKWorkoutSession (share), and
 *  - iPhone-side post-workout export of HKWorkout + HR samples (update).
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
    mod.modResults[HEALTH_SHARE_KEY] = HEALTH_SHARE_MESSAGE;
    mod.modResults[HEALTH_UPDATE_KEY] = HEALTH_UPDATE_MESSAGE;
    return mod;
  });

  return config;
};

module.exports = createRunOncePlugin(withWatchExtension, PLUGIN_NAME, '1.0.0');
