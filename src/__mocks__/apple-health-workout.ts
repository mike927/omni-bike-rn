export const AppleHealthWorkout = {
  saveCyclingWorkout: jest.fn(() => Promise.resolve('mock-workout-uuid')),
  requestHealthKitAuthorization: jest.fn(() => Promise.resolve()),
  queryBasalEnergyKcal: jest.fn(() => Promise.resolve(0)),
  getBiologicalSex: jest.fn(() => Promise.resolve(null)),
  getDateOfBirth: jest.fn(() => Promise.resolve(null)),
  getLatestWeightKg: jest.fn(() => Promise.resolve(null)),
  getLatestHeightCm: jest.fn(() => Promise.resolve(null)),
  getWriteAuthorizationStatus: jest.fn(() => ({})),
};
