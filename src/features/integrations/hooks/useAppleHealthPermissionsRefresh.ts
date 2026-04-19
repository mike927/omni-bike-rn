import { useEffect, useRef } from 'react';

import { initWithWritePermissions } from '../../../services/health/appleHealthAdapter';
import { useAppleHealthConnectionStore } from '../../../store/appleHealthConnectionStore';

/**
 * Re-requests HealthKit authorization on app start when Apple Health is
 * persisted as connected. iOS suppresses the permission sheet for already-
 * decided types, so this is a no-op in the common case — but when a new
 * permission has been added (e.g. BasalEnergyBurned), existing users get the
 * sheet for the new entry on next launch instead of silently continuing with
 * Active = Total exports.
 *
 * Mount once at the app root.
 */
export function useAppleHealthPermissionsRefresh(): void {
  const hydrated = useAppleHealthConnectionStore((s) => s.hydrated);
  const connected = useAppleHealthConnectionStore((s) => s.connected);
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || !connected || refreshedRef.current) return;
    refreshedRef.current = true;
    void initWithWritePermissions().catch((error: unknown) => {
      // Swallow — this is a best-effort refresh, not the initial connect flow.
      // The user remains marked connected; any real permission gap surfaces as
      // a graceful 0-basal fallback on the first post-launch upload.
      console.error('[useAppleHealthPermissionsRefresh] refresh failed:', error);
    });
  }, [hydrated, connected]);
}
