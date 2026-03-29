const createMockDatabase = () => ({
  closeAsync: jest.fn().mockResolvedValue(undefined),
  closeSync: jest.fn(),
  execAsync: jest.fn().mockResolvedValue(undefined),
  execSync: jest.fn(),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getAllSync: jest.fn().mockReturnValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  getFirstSync: jest.fn().mockReturnValue(null),
  prepareAsync: jest.fn(),
  prepareSync: jest.fn(),
  runAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 }),
  runSync: jest.fn().mockReturnValue({ changes: 0, lastInsertRowId: 0 }),
  withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
    await task();
  }),
  withTransactionSync: jest.fn((task: () => void) => {
    task();
  }),
});

let mockDatabase = createMockDatabase();

export const addDatabaseChangeListener = jest.fn(() => ({
  remove: jest.fn(),
}));

export const openDatabaseAsync = jest.fn(async () => mockDatabase);
export const openDatabaseSync = jest.fn(() => mockDatabase);

export function __setMockDatabase(database: ReturnType<typeof createMockDatabase>): void {
  mockDatabase = database;
}

export function __resetExpoSQLiteMock(): void {
  mockDatabase = createMockDatabase();
  openDatabaseAsync.mockClear();
  openDatabaseSync.mockClear();
  addDatabaseChangeListener.mockClear();
}
