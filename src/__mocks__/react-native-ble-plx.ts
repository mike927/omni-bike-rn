export const BleManager = jest.fn().mockImplementation(() => ({
  connectToDevice: jest.fn(),
  cancelDeviceConnection: jest.fn(),
  monitorCharacteristicForDevice: jest.fn(),
  state: jest.fn(),
  startDeviceScan: jest.fn(),
  stopDeviceScan: jest.fn(),
}));

export const Device = jest.fn();
export const Subscription = jest.fn();
