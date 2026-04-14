import { fireEvent, render } from '@testing-library/react-native';

import { InterruptedSessionCard } from '../InterruptedSessionCard';

describe('InterruptedSessionCard', () => {
  it('renders the interrupted workout summary and fires both actions', () => {
    const onResume = jest.fn();
    const onDiscard = jest.fn();

    const { getByText } = render(
      <InterruptedSessionCard
        session={{
          id: 'session-1',
          status: 'paused',
          startedAtMs: new Date('2026-04-14T10:00:00.000Z').getTime(),
          endedAtMs: null,
          elapsedSeconds: 600,
          totalDistanceMeters: 5400,
          totalCaloriesKcal: 88.4,
          currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: 5400 },
          savedBikeSnapshot: null,
          savedHrSnapshot: null,
          uploadState: null,
          createdAtMs: 100,
          updatedAtMs: 700,
        }}
        onResume={onResume}
        onDiscard={onDiscard}
      />,
    );

    expect(getByText('Interrupted Session')).toBeTruthy();
    expect(getByText('00:10:00 elapsed')).toBeTruthy();
    expect(getByText('5.40 km • 88.4 kcal')).toBeTruthy();

    fireEvent.press(getByText('Resume'));
    fireEvent.press(getByText('Discard'));

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
