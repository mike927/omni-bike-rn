export const AppleHealthWorkout = {
  saveCyclingWorkout: jest.fn(() => Promise.resolve('mock-workout-uuid')),
  requestCyclingMetricsAuthorization: jest.fn(() => Promise.resolve()),
};
