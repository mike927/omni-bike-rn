module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  clearMocks: true,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(-[a-z-]+)?|@expo(-[a-z-]+)?/)/)',
  ],
  moduleNameMapper: {
    '^react-native-ble-plx$': '<rootDir>/src/__mocks__/react-native-ble-plx.ts',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/src/__mocks__/@react-native-async-storage/async-storage.ts',
    '^expo-sqlite$': '<rootDir>/src/__mocks__/expo-sqlite.ts',
    '^expo-sqlite/kv-store$': '<rootDir>/src/__mocks__/expo-sqlite/kv-store.ts',
    '\\.sql$': '<rootDir>/src/__mocks__/sql.ts',
    '^expo-web-browser$': '<rootDir>/src/__mocks__/expo-web-browser.ts',
    '^expo-secure-store$': '<rootDir>/src/__mocks__/expo-secure-store.ts',
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
