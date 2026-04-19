const AppleHealthKit = {
  initHealthKit: jest.fn(),
  saveWorkout: jest.fn(),
  saveHeartRateSample: jest.fn(),
  getBiologicalSex: jest.fn(),
  getDateOfBirth: jest.fn(),
  getLatestWeight: jest.fn(),
  getLatestHeight: jest.fn(),
  Constants: {
    Activities: {
      Cycling: 'Cycling',
    },
    Permissions: {
      Workout: 'Workout',
      HeartRate: 'HeartRate',
      ActiveEnergyBurned: 'ActiveEnergyBurned',
      DistanceCycling: 'DistanceCycling',
      BasalEnergyBurned: 'BasalEnergyBurned',
      BiologicalSex: 'BiologicalSex',
      DateOfBirth: 'DateOfBirth',
      Weight: 'Weight',
      Height: 'Height',
    },
    Units: {
      bpm: 'bpm',
      kilocalorie: 'kilocalorie',
      meter: 'meter',
      gram: 'gram',
      kg: 'kg',
      cm: 'cm',
      pound: 'pound',
      inch: 'inch',
    },
  },
};

export default AppleHealthKit;

export type HealthKitPermissions = { permissions: { read: string[]; write: string[] } };
