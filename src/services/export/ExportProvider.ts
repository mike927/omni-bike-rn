import type { GearType } from '../../types/gear';
import type { ProviderGearSummary } from '../../types/providerGear';
import type { PersistedTrainingSession, PersistedTrainingSample } from '../../types/sessionPersistence';

export interface ExportResult {
  success: boolean;
  externalId?: string;
  errorMessage?: string;
  warningMessage?: string;
}

/**
 * Outcome of reconciling an uploaded activity's gear with the local provider-gear link.
 * Gear reconciliation never fails the upload — at worst it returns a `warning` the caller
 * surfaces to the user. `linkInvalid` tells the caller the local link should be marked stale.
 */
export type GearReconcileOutcome = { status: 'ok' } | { status: 'warning'; linkInvalid: boolean; message: string };

export interface ExportProvider {
  readonly name: string;
  readonly id: string;
  isConfigured(): boolean;
  exportSession(session: PersistedTrainingSession, samples: PersistedTrainingSample[]): Promise<ExportResult>;
  listAvailableGear?: (gearType: GearType) => Promise<ProviderGearSummary[]>;
  /**
   * Reconcile the uploaded activity's gear to match the local link.
   * `desiredProviderGearId` is the linked provider gear id, or `null` to clear any provider default.
   * Owns provider-specific failure classification; the caller stays provider-agnostic.
   */
  reconcileGear?: (activityId: string, desiredProviderGearId: string | null) => Promise<GearReconcileOutcome>;
  attachGearToActivity?: (activityId: string, providerGearId: string) => Promise<void>;
  clearGearFromActivity?: (activityId: string) => Promise<void>;
}
