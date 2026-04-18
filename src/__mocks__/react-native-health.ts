const AppleHealthKit = {
  initHealthKit: jest.fn(),
  saveWorkout: jest.fn(),
  saveHeartRateSample: jest.fn(),
  Constants: {
    Activities: {
      Cycling: 'Cycling',
    },
    Permissions: {
      Workout: 'Workout',
      HeartRate: 'HeartRate',
      ActiveEnergyBurned: 'ActiveEnergyBurned',
      DistanceCycling: 'DistanceCycling',
    },
    Units: {
      bpm: 'bpm',
      kilocalorie: 'kilocalorie',
      meter: 'meter',
    },
  },
};

export default AppleHealthKit;

export type HealthKitPermissions = { permissions: { read: string[]; write: string[] } };
