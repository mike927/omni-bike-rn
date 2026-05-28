export const AppleHealthWorkout = {
  saveCyclingWorkout: jest.fn(() => Promise.resolve('mock-workout-uuid')),
  requestHealthKitAuthorization: jest.fn(() => Promise.resolve()),
};
