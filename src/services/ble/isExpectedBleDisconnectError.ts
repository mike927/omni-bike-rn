import type { BleError } from './BleError';

const OPERATION_CANCELLED_ERROR_CODE = 2;
const DEVICE_DISCONNECTED_ERROR_CODE = 201;
const DEVICE_NOT_CONNECTED_ERROR_CODE = 205;

export function isExpectedBleDisconnectError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const bleError = error as BleError;

  return (
    bleError.errorCode === OPERATION_CANCELLED_ERROR_CODE ||
    bleError.message.includes('Operation was cancelled') ||
    bleError.errorCode === DEVICE_DISCONNECTED_ERROR_CODE ||
    bleError.message.includes('was disconnected') ||
    bleError.errorCode === DEVICE_NOT_CONNECTED_ERROR_CODE ||
    bleError.message.includes('is not connected')
  );
}
