import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '../../../drizzle/migrations';

import { getDrizzleDb } from './database';

let initializationPromise: Promise<void> | null = null;
let initialized = false;

export function initializeDatabase(): Promise<void> {
  if (initialized) {
    return Promise.resolve();
  }

  if (initializationPromise !== null) {
    return initializationPromise;
  }

  initializationPromise = migrate(getDrizzleDb(), migrations)
    .then(() => {
      initialized = true;
    })
    .catch((error: unknown) => {
      initializationPromise = null;
      throw error;
    });

  return initializationPromise;
}

export function resetDatabaseInitializationForTests(): void {
  initializationPromise = null;
  initialized = false;
}
