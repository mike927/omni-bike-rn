/**
 * Shared dev-only tracer for the Watch↔iPhone WatchConnectivity link. Every WC event
 * arrival, availability transition, and stream-lifecycle step routes through here so the
 * flow is observable in Metro — this link is flaky in the field, so making it debuggable
 * from logs (not guesswork) is worth the lines. The native module mirrors the same events
 * into NSLog + an on-device `wc.log` (richer, retrievable per-device); this is the JS view.
 * `console.warn` is lint-allowed; gated on __DEV__ so nothing ships to production logs.
 */
export function logWc(message: string): void {
  if (__DEV__) {
    console.warn(`[WC-JS] ${message}`);
  }
}
