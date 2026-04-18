const { createRunOncePlugin, withEntitlementsPlist } = require('@expo/config-plugins');

const PLUGIN_NAME = 'with-watch-extension';

const HEALTHKIT_ENTITLEMENT = 'com.apple.developer.healthkit';
const HEALTHKIT_ACCESS_ENTITLEMENT = 'com.apple.developer.healthkit.access';

/**
 * Adds the HealthKit entitlement required for the watchOS companion app to
 * read HR via HKWorkoutSession, and strips the `com.apple.developer.healthkit.access`
 * key that `react-native-health`'s plugin writes unconditionally.
 *
 * The .access array is Apple's opt-in for Clinical Records (Verifiable Health
 * Records) and requires an entitlement that Apple has to grant to the team /
 * bundle id. Omni Bike does not use clinical records, so writing even an empty
 * array still causes the build to fail with "Provisioning profile doesn't
 * include the HealthKit Access (Verifiable Health Records) capability". This
 * plugin runs after `react-native-health` (see plugin ordering in
 * `app.config.ts`) and removes the key.
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
    delete mod.modResults[HEALTHKIT_ACCESS_ENTITLEMENT];
    return mod;
  });

  return config;
};

module.exports = createRunOncePlugin(withWatchExtension, PLUGIN_NAME, '1.0.0');
