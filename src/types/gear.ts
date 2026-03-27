export type GearType = 'bike' | 'hr';

export interface SavedDevice {
  id: string;
  name: string;
  type: GearType;
}

export interface SavedGear {
  savedBike: SavedDevice | null;
  savedHrSource: SavedDevice | null;
}

export type ValidationFailureReason =
  | 'missing_ftms_service'
  | 'missing_indoor_bike_characteristic'
  | 'missing_hr_service'
  | 'missing_hr_characteristic'
  | 'no_live_signal';

export interface GearValidationResult {
  valid: boolean;
  reason?: ValidationFailureReason;
}

export type ReconnectState = 'idle' | 'connecting' | 'connected' | 'failed';
