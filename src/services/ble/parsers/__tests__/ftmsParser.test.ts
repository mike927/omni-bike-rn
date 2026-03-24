import { BikeStatus } from '../../BikeAdapter';
import { parseFtmsMachineStatus } from '../ftmsParser';

describe('parseFtmsMachineStatus', () => {
  it('maps reset and stopped op codes to a stopped bike status', () => {
    expect(parseFtmsMachineStatus(new Uint8Array([0x01]))).toBe(BikeStatus.Stopped);
    expect(parseFtmsMachineStatus(new Uint8Array([0x02]))).toBe(BikeStatus.Stopped);
  });

  it('maps the Zipro start/resume op code to a started bike status', () => {
    expect(parseFtmsMachineStatus(new Uint8Array([0x04]))).toBe(BikeStatus.Started);
  });

  it('ignores non-state machine status op codes', () => {
    expect(parseFtmsMachineStatus(new Uint8Array([0x07]))).toBeUndefined();
    expect(parseFtmsMachineStatus(new Uint8Array([0x08]))).toBeUndefined();
    expect(parseFtmsMachineStatus(new Uint8Array([0x0a]))).toBeUndefined();
  });

  it('returns undefined for empty payloads', () => {
    expect(parseFtmsMachineStatus(new Uint8Array([]))).toBeUndefined();
  });
});
