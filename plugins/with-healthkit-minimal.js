const { createRunOncePlugin, withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

const PLUGIN_NAME = 'with-healthkit-minimal';

/**
 * Minimal HealthKit config: Info.plist usage descriptions + the
 * `com.apple.developer.healthkit` entitlement.
 *
 * The local apple-health-workout module needs no Clinical Records access.
 * Writing `com.apple.developer.healthkit.access = []`
 * requires the "HealthKit Access (Verifiable Health Records)" capability to
 * be granted to the Apple Developer team / bundle id. Omni Bike does not use
 * Clinical Records, so writing the key fails provisioning profile generation
 * with: "Provisioning profile doesn't include the HealthKit Access
 * (Verifiable Health Records) capability".
 *
 * Expo autolinking links the local module independently of this plugin.
 */
const withHealthKitMinimal = (config, { healthSharePermission, healthUpdatePermission } = {}) => {
  config = withInfoPlist(config, (cfg) => {
    if (healthSharePermission) {
      cfg.modResults.NSHealthShareUsageDescription = healthSharePermission;
    }
    if (healthUpdatePermission) {
      cfg.modResults.NSHealthUpdateUsageDescription = healthUpdatePermission;
    }
    return cfg;
  });

  config = withEntitlementsPlist(config, (cfg) => {
    cfg.modResults['com.apple.developer.healthkit'] = true;
    delete cfg.modResults['com.apple.developer.healthkit.access'];
    return cfg;
  });

  return config;
};

module.exports = createRunOncePlugin(withHealthKitMinimal, PLUGIN_NAME, '1.0.0');
