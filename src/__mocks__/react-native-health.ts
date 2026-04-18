const AppleHealthKit = {
  initHealthKit: jest.fn(),
  saveWorkout: jest.fn(),
  saveHeartRateSample: jest.fn(),
};

export default AppleHealthKit;

export const HealthActivity = {
  Cycling: 'Cycling',
};

export const HealthPermission = {
  Workout: 'Workout',
  HeartRate: 'HeartRate',
  ActiveEnergyBurned: 'ActiveEnergyBurned',
  DistanceCycling: 'DistanceCycling',
};

export const HealthUnit = {
  bpm: 'bpm',
  kilocalorie: 'kilocalorie',
  meter: 'meter',
};

export type HealthKitPermissions = { permissions: { read: string[]; write: string[] } };
