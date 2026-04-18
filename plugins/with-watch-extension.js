const { createRunOncePlugin, withEntitlementsPlist } = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-watch-extension';

const HEALTHKIT_ENTITLEMENT = 'com.apple.developer.healthkit';

/**
 * Adds the HealthKit entitlement required for the watchOS companion app to
 * read HR via HKWorkoutSession.
 *
 * NSHealthShareUsageDescription / NSHealthUpdateUsageDescription are owned by
 * the `react-native-health` plugin (see app.config.ts) to keep a single source
 * of truth for those strings.
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

  return config;
};

module.exports = createRunOncePlugin(withWatchExtension, PLUGIN_NAME, '1.0.0');
