/** Thrown by connectBike/connectHr when a connect attempt is already in flight. */
export class ConnectInProgressError extends Error {
  constructor(kind: 'bike' | 'hr') {
    super(`A ${kind} connect attempt is already in progress`);
    this.name = 'ConnectInProgressError';
  }
}

export function isConnectInProgressError(err: unknown): boolean {
  return err instanceof ConnectInProgressError;
}
