// Mock console.error to keep test output clean, unless we explicitly want to see it
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Warning: ReactDOM.render is no longer supported in React 18.')) {
    return;
  }
  // uncomment if you want to silence all errors
  originalConsoleError(...args);
};
