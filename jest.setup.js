// Mock console.error to keep test output clean, unless we explicitly want to see it
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0];
  if (typeof message === 'string') {
    // Silence React 18 warning
    if (message.includes('Warning: ReactDOM.render is no longer supported in React 18.')) {
      return;
    }

    // Silence expected test errors
    const expectedErrors = [
      '[useAutoReconnect] Bike connect failed:',
      '[useDeviceConnection] Bike disconnect error:',
      '[ZiproRave] Failed to subscribe:',
      '[gearStorage] Failed to load saved gear:',
      '[TrainingSessionStore] Invalid transition',
      '[TrainingSessionStore] resume() is only valid from Paused',
      '[bleDeviceValidator] Bike validation error:',
      '[bleDeviceValidator] HR validation error:',
      '[useTrainingSessionPersistence] Failed to persist training session state:',
    ];

    if (expectedErrors.some((err) => message.includes(err))) {
      return;
    }
  }

  // uncomment if you want to silence all errors
  originalConsoleError(...args);
};
