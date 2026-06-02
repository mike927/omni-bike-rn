import { render } from '@testing-library/react-native';

import { HistorySummaryStrip } from '../HistorySummaryStrip';

describe('HistorySummaryStrip', () => {
  it('renders the monthly ride count, rounded distance, and compact time', () => {
    const { getByText } = render(
      <HistorySummaryStrip summary={{ rideCount: 12, totalDistanceMeters: 214300, totalDurationSeconds: 34800 }} />,
    );

    expect(getByText('This Month')).toBeTruthy();
    expect(getByText('12')).toBeTruthy();
    expect(getByText('rides')).toBeTruthy();

    expect(getByText('Distance')).toBeTruthy();
    expect(getByText('214')).toBeTruthy();
    expect(getByText('km')).toBeTruthy();

    expect(getByText('Time')).toBeTruthy();
    expect(getByText('9h 40m')).toBeTruthy();
  });

  it('renders zeros without crashing for an empty month', () => {
    const { getByText } = render(
      <HistorySummaryStrip summary={{ rideCount: 0, totalDistanceMeters: 0, totalDurationSeconds: 0 }} />,
    );

    expect(getByText('0m')).toBeTruthy();
  });
});
