import { fireEvent, render } from '@testing-library/react-native';

import { formatHistoryDate } from '../../../../ui/formatters';
import type { PersistedTrainingSession } from '../../../../types/sessionPersistence';
import { WorkoutHistoryListItem } from '../WorkoutHistoryListItem';

function buildSession(overrides: Partial<PersistedTrainingSession>): PersistedTrainingSession {
  return {
    id: 'session',
    status: 'finished',
    startedAtMs: new Date(2021, 0, 1).getTime(), // Fri, Jan 1
    endedAtMs: null,
    elapsedSeconds: 3720, // 1h 2m
    totalDistanceMeters: 18400, // 18.4 km
    totalCaloriesKcal: 512,
    currentMetrics: { speed: 0, cadence: 0, power: 0, heartRate: null, resistance: null, distance: null },
    savedBikeSnapshot: null,
    savedHrSnapshot: null,
    uploadState: null,
    createdAtMs: 0,
    updatedAtMs: 0,
    ...overrides,
  };
}

describe('WorkoutHistoryListItem', () => {
  it('renders the compact date and metrics line', () => {
    const session = buildSession({});
    const { getByText } = render(
      <WorkoutHistoryListItem session={session} uploadedProviderIds={[]} onPress={jest.fn()} onDelete={jest.fn()} />,
    );

    expect(getByText(formatHistoryDate(session.startedAtMs))).toBeTruthy();
    expect(getByText('18.4 km · 1h 2m · 512 kcal')).toBeTruthy();
  });

  it('opens the summary when pressed', () => {
    const session = buildSession({});
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <WorkoutHistoryListItem session={session} uploadedProviderIds={[]} onPress={onPress} onDelete={jest.fn()} />,
    );

    fireEvent.press(getByLabelText(`Workout on ${formatHistoryDate(session.startedAtMs)}`));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('requests deletion on long press', () => {
    const session = buildSession({});
    const onDelete = jest.fn();
    const { getByLabelText } = render(
      <WorkoutHistoryListItem session={session} uploadedProviderIds={[]} onPress={jest.fn()} onDelete={onDelete} />,
    );

    fireEvent(getByLabelText(`Workout on ${formatHistoryDate(session.startedAtMs)}`), 'longPress');

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('exposes an accessible delete action for assistive tech (not only long press)', () => {
    const session = buildSession({});
    const onDelete = jest.fn();
    const { getByLabelText } = render(
      <WorkoutHistoryListItem session={session} uploadedProviderIds={[]} onPress={jest.fn()} onDelete={onDelete} />,
    );

    const row = getByLabelText(`Workout on ${formatHistoryDate(session.startedAtMs)}`);
    expect(row.props.accessibilityActions).toEqual([{ name: 'delete', label: 'Delete workout' }]);

    fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated accessibility actions', () => {
    const session = buildSession({});
    const onDelete = jest.fn();
    const { getByLabelText } = render(
      <WorkoutHistoryListItem session={session} uploadedProviderIds={[]} onPress={jest.fn()} onDelete={onDelete} />,
    );

    fireEvent(getByLabelText(`Workout on ${formatHistoryDate(session.startedAtMs)}`), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(onDelete).not.toHaveBeenCalled();
  });
});
