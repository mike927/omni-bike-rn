/**
 * HealthKit permission helpers.
 *
 * For the Apple Watch HR integration (Phase 8), HealthKit authorization is
 * handled by the Watch companion app on the watchOS side — the iPhone app does
 * not need to request HealthKit permissions directly for WatchConnectivity HR
 * streaming.
 *
 * The HealthKit entitlement is present in the host app's entitlements file to
 * satisfy App Store distribution requirements for apps with a watchOS companion
 * that uses HKWorkoutSession.
 *
 * When Apple Health export lands (Phase 4), this module will be expanded to
 * request read/write authorization for completed workout samples.
 */

// Phase 4 placeholder — no exports yet.
