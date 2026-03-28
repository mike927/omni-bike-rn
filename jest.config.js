module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  clearMocks: true,
  moduleNameMapper: {
    '^react-native-ble-plx$': '<rootDir>/src/__mocks__/react-native-ble-plx.ts',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/src/__mocks__/@react-native-async-storage/async-storage.ts',
    '^expo-sqlite/kv-store$': '<rootDir>/src/__mocks__/expo-sqlite/kv-store.ts',
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
