import { reconnectLabel } from '../reconnectLabel';

describe('reconnectLabel', () => {
  it('returns "Connecting..." for connecting state', () => {
    expect(reconnectLabel('connecting')).toBe('Connecting...');
  });

  it('returns "Connected" for connected state', () => {
    expect(reconnectLabel('connected')).toBe('Connected');
  });

  it('returns "Disconnected" for failed state', () => {
    expect(reconnectLabel('failed')).toBe('Disconnected');
  });

  it('returns "Disconnected" for disconnected state', () => {
    expect(reconnectLabel('disconnected')).toBe('Disconnected');
  });

  it('returns "Disconnected" for idle state', () => {
    expect(reconnectLabel('idle')).toBe('Disconnected');
  });
});
