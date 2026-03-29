import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { getDrizzleDb } from '../database';
import { initializeDatabase, resetDatabaseInitializationForTests } from '../migrations';

jest.mock('../database', () => ({
  getDrizzleDb: jest.fn(),
}));

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  migrate: jest.fn(),
}));

describe('migrations', () => {
  const mockGetDrizzleDb = getDrizzleDb as jest.MockedFunction<typeof getDrizzleDb>;
  const mockMigrate = migrate as jest.MockedFunction<typeof migrate>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetDatabaseInitializationForTests();
  });

  it('initializes generated migrations on first run', async () => {
    mockGetDrizzleDb.mockReturnValue({} as never);
    mockMigrate.mockResolvedValue(undefined);

    await initializeDatabase();

    expect(mockMigrate).toHaveBeenCalledTimes(1);
    expect(mockMigrate).toHaveBeenCalledWith(
      mockGetDrizzleDb.mock.results[0]?.value,
      expect.objectContaining({
        journal: expect.objectContaining({
          entries: expect.any(Array),
        }),
        migrations: expect.any(Object),
      }),
    );
  });

  it('does not rerun migrations after initialization succeeds', async () => {
    mockGetDrizzleDb.mockReturnValue({} as never);
    mockMigrate.mockResolvedValue(undefined);

    await initializeDatabase();
    await initializeDatabase();

    expect(mockMigrate).toHaveBeenCalledTimes(1);
  });

  it('reuses the in-flight initialization promise', async () => {
    mockGetDrizzleDb.mockReturnValue({} as never);

    let resolveMigration!: () => void;
    const migrationPromise = new Promise<void>((resolve) => {
      resolveMigration = resolve;
    });

    mockMigrate.mockReturnValue(migrationPromise);

    const firstInitialization = initializeDatabase();
    const secondInitialization = initializeDatabase();

    expect(firstInitialization).toBe(secondInitialization);
    expect(mockMigrate).toHaveBeenCalledTimes(1);

    resolveMigration();
    await firstInitialization;
  });

  it('allows retry after a failed migration', async () => {
    mockGetDrizzleDb.mockReturnValue({} as never);
    mockMigrate.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);

    await expect(initializeDatabase()).rejects.toThrow('disk full');
    await initializeDatabase();

    expect(mockMigrate).toHaveBeenCalledTimes(2);
  });
});
