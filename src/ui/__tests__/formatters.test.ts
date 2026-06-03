import {
  formatCompactDuration,
  formatDistanceKm,
  formatDistanceKmShort,
  formatDuration,
  formatHistoryDate,
  formatMetricValue,
} from '../formatters';

describe('formatHistoryDate', () => {
  it('formats a timestamp as weekday, month, and day', () => {
    // 2021-01-01 was a Friday.
    expect(formatHistoryDate(new Date(2021, 0, 1).getTime())).toBe('Fri, Jan 1');
  });
});

describe('formatDuration', () => {
  it('pads short durations', () => {
    expect(formatDuration(9)).toBe('00:00:09');
  });

  it('formats durations over an hour', () => {
    expect(formatDuration(3671)).toBe('01:01:11');
  });
});

describe('formatCompactDuration', () => {
  it('shows only minutes under an hour', () => {
    expect(formatCompactDuration(2280)).toBe('38m');
  });

  it('shows hours and minutes over an hour', () => {
    expect(formatCompactDuration(3720)).toBe('1h 2m');
  });

  it('drops a zero minute remainder on whole hours', () => {
    expect(formatCompactDuration(3600)).toBe('1h');
  });

  it('rounds sub-minute durations down to whole minutes', () => {
    expect(formatCompactDuration(59)).toBe('0m');
  });

  it('aggregates multi-hour totals', () => {
    expect(formatCompactDuration(34800)).toBe('9h 40m');
  });
});

describe('formatDistanceKmShort', () => {
  it('formats meters as one-decimal kilometers', () => {
    expect(formatDistanceKmShort(18400)).toBe('18.4 km');
  });

  it('keeps a trailing zero', () => {
    expect(formatDistanceKmShort(1000)).toBe('1.0 km');
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
