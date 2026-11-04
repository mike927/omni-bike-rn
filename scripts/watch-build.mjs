import { WATCH_BUNDLE_IDS } from './watch-log.mjs';

export function compareCompanionBundles(bundles) {
  const complete = ['phone', 'watch', 'embeddedWatch'].every((target) => bundles[target]);
  const matched = complete
    ? bundles.phone.bundleId === WATCH_BUNDLE_IDS.phone &&
      bundles.watch.bundleId === WATCH_BUNDLE_IDS.watch &&
      bundles.embeddedWatch.bundleId === WATCH_BUNDLE_IDS.watch &&
      bundles.watch.companionBundleId === WATCH_BUNDLE_IDS.phone &&
      bundles.embeddedWatch.companionBundleId === WATCH_BUNDLE_IDS.phone &&
      Boolean(bundles.phone.team) &&
      bundles.phone.team === bundles.watch.team &&
      bundles.phone.team === bundles.embeddedWatch.team
    : null;
  const identicalWatchProducts =
    bundles.watch?.codeHash && bundles.embeddedWatch?.codeHash
      ? bundles.watch.codeHash === bundles.embeddedWatch.codeHash
      : null;
  return { matched, identicalWatchProducts };
}
