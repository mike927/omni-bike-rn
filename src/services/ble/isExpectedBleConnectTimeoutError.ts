import type { BleError } from './BleError';

const OPERATION_TIMED_OUT_MESSAGE = 'Operation timed out';

export function isExpectedBleConnectTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const bleError = error as BleError;
  return bleError.message.includes(OPERATION_TIMED_OUT_MESSAGE);
}
