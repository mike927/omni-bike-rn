import { formatDistanceKm, formatDuration, formatMetricValue } from '../formatters';

describe('formatDuration', () => {
  it('pads short durations', () => {
    expect(formatDuration(9)).toBe('00:00:09');
  });

  it('formats durations over an hour', () => {
    expect(formatDuration(3671)).toBe('01:01:11');
  });
});

describe('formatDistanceKm', () => {
  it('formats meters as kilometers', () => {
    expect(formatDistanceKm(2450)).toBe('2.45 km');
  });
});

describe('formatMetricValue', () => {
  it('returns a placeholder for missing values', () => {
    expect(formatMetricValue(null, ' bpm')).toBe('--');
  });

  it('formats present values with a suffix', () => {
    expect(formatMetricValue(142, ' bpm')).toBe('142 bpm');
  });
});
