import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import * as schema from './schema';

const DATABASE_NAME = 'omni-bike.db';

export type AppDatabase = ExpoSQLiteDatabase<typeof schema> & {
  $client: SQLiteDatabase;
};

let sqliteDatabase: SQLiteDatabase | null = null;
let drizzleDatabase: AppDatabase | null = null;

export function getSQLiteDatabase(): SQLiteDatabase {
  sqliteDatabase ??= openDatabaseSync(DATABASE_NAME);

  return sqliteDatabase;
}

export function getDrizzleDb(): AppDatabase {
  drizzleDatabase ??= drizzle(getSQLiteDatabase(), { schema });

  return drizzleDatabase;
}

export function resetDatabaseClientsForTests(): void {
  sqliteDatabase = null;
  drizzleDatabase = null;
}
