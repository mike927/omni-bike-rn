import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import {
  POST_FINISH_TRAINING_SUMMARY_SOURCE,
  SAVED_SESSION_TRAINING_SUMMARY_SOURCE,
} from '../../navigation/trainingSummaryRoute';
import { TrainingSummaryScreen } from '../TrainingSummaryScreen';

const mockReplace = jest.fn();
const mockDeleteSession = jest.fn();
const mockGetSessionById = jest.fn();
const mockGetProviderUpload = jest.fn();
const mockUploadSessionToProvider = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('../../../../services/db/trainingSessionRepository', () => ({
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  getSessionById: (...args: unknown[]) => mockGetSessionById(...args),
}));

jest.mock('../../../../services/db/providerUploadRepository', () => ({
  getProviderUpload: (...args: unknown[]) => mockGetProviderUpload(...args),
}));

jest.mock('../../../../services/export/uploadOrchestrator', () => ({
  uploadSessionToProvider: (...args: unknown[]) => mockUploadSessionToProvider(...args),
}));

const mockStravaGetState = jest.fn();
jest.mock('../../../../store/stravaConnectionStore', () => ({
  useStravaConnectionStore: {
    getState: (...args: unknown[]) => mockStravaGetState(...args),
  },
}));

const mockAppleHealthGetState = jest.fn();
jest.mock('../../../../store/appleHealthConnectionStore', () => ({
  useAppleHealthConnectionStore: {
    getState: (...args: unknown[]) => mockAppleHealthGetState(...args),
  },
}));

describe('TrainingSummaryScreen', () => {
  const session = {
    id: 'session-1',
    status: 'finished' as const,
    startedAtMs: 100,
    endedAtMs: 200,
    elapsedSeconds: 120,
    totalDistanceMeters: 1000,
    totalCaloriesKcal: 50,
    currentMetrics: { speed: 20, cadence: 80, power: 200, heartRate: 145, resistance: 6, distance: 1000 },
    savedBikeSnapshot: null,
    savedHrSnapshot: null,
    uploadState: 'ready' as const,
    createdAtMs: 100,
    updatedAtMs: 200,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionById.mockReturnValue(session);
    mockGetProviderUpload.mockReturnValue(null);
    mockUploadSessionToProvider.mockResolvedValue({ providerId: 'strava', success: true, externalId: 'upload-1' });
    // Default: providers connected so upload guards pass in most tests.
    mockStravaGetState.mockReturnValue({ connected: true });
    mockAppleHealthGetState.mockReturnValue({ connected: true });
  });

  it('shows a missing-session state when no persisted session exists', () => {
    mockGetSessionById.mockReturnValue(null);

    const { getByText } = render(
      <TrainingSummaryScreen sessionId="missing" source={SAVED_SESSION_TRAINING_SUMMARY_SOURCE} returnTo={null} />,
    );

    expect(getByText('Workout Not Found')).toBeTruthy();
    expect(getByText('Back Home')).toBeTruthy();
  });

  it('renders persisted workout totals and final metrics', () => {
    const { getByText } = render(
      <TrainingSummaryScreen sessionId="session-1" source={POST_FINISH_TRAINING_SUMMARY_SOURCE} returnTo="/" />,
    );

    expect(getByText('Workout Totals')).toBeTruthy();
    expect(getByText('Final Metrics')).toBeTruthy();
    expect(getByText('00:02:00')).toBeTruthy();
    expect(getByText('1.00 km')).toBeTruthy();
    expect(getByText('50.0 kcal')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
    expect(getByText('Strava Upload')).toBeTruthy();
    expect(getByText('Upload to Strava')).toBeTruthy();
  });

  it('deletes the session after confirming discard', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      buttons?.[1]?.onPress?.();
    });

    const { getByText } = render(
      <TrainingSummaryScreen sessionId="session-1" source={POST_FINISH_TRAINING_SUMMARY_SOURCE} returnTo="/" />,
    );

    fireEvent.press(getByText('Discard'));

    expect(mockDeleteSession).toHaveBeenCalledWith('session-1');
    expect(mockReplace).toHaveBeenCalledWith('/');

    alertSpy.mockRestore();
  });

  it('returns to the provided route when discarding a saved workout summary', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      buttons?.[1]?.onPress?.();
    });

    const { getByText } = render(
      <TrainingSummaryScreen
        sessionId="session-1"
        source={SAVED_SESSION_TRAINING_SUMMARY_SOURCE}
        returnTo="/history"
      />,
    );

    fireEvent.press(getByText('Discard'));

    expect(mockDeleteSession).toHaveBeenCalledWith('session-1');
    expect(mockReplace).toHaveBeenCalledWith('/history');

    alertSpy.mockRestore();
  });

  it('returns home when save is pressed after finishing a ride', async () => {
    const { getByText } = render(
      <TrainingSummaryScreen sessionId="session-1" source={POST_FINISH_TRAINING_SUMMARY_SOURCE} returnTo="/" />,
    );

    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('shows Done for already-saved workouts and returns to the previous screen', async () => {
    const { getByText, queryByText } = render(
      <TrainingSummaryScreen
        sessionId="session-1"
        source={SAVED_SESSION_TRAINING_SUMMARY_SOURCE}
        returnTo="/history"
      />,
    );

    expect(getByText('Done')).toBeTruthy();
    expect(queryByText('Save')).toBeNull();

    fireEvent.press(getByText('Done'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/history');
    });
  });

  it('falls back to home when a saved workout summary has no explicit return route', async () => {
    const { getByText } = render(
      <TrainingSummaryScreen sessionId="session-1" source={SAVED_SESSION_TRAINING_SUMMARY_SOURCE} returnTo={null} />,
    );

    fireEvent.press(getByText('Done'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('uploads a workout to Strava from the summary screen', async () => {
    const uploadedUpload = {
      id: 'upload-1',
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'uploaded' as const,
      externalId: 'strava-activity-1',
      errorMessage: null,
      createdAtMs: 100,
      updatedAtMs: 200,
    };
    const stravaCalls: number[] = [];
    mockGetProviderUpload.mockImplementation((_sessionId: string, providerId: string) => {
      if (providerId !== 'strava') return null;
      stravaCalls.push(1);
      return stravaCalls.length === 1 ? null : uploadedUpload;
    });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const { getByText } = render(
      <TrainingSummaryScreen
        sessionId="session-1"
        source={SAVED_SESSION_TRAINING_SUMMARY_SOURCE}
        returnTo="/history"
      />,
    );

    fireEvent.press(getByText('Upload to Strava'));

    await waitFor(() => {
      expect(mockUploadSessionToProvider).toHaveBeenCalledWith('session-1', 'strava');
    });
    expect(getByText('Strava Uploaded')).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith('Upload Complete', 'This workout was uploaded to Strava.');

    alertSpy.mockRestore();
  });

  it('shows a not-connected alert when upload is tapped without Strava connected', async () => {
    mockStravaGetState.mockReturnValue({ connected: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    const { getByText } = render(
      <TrainingSummaryScreen
        sessionId="session-1"
        source={SAVED_SESSION_TRAINING_SUMMARY_SOURCE}
        returnTo="/history"
      />,
    );

    fireEvent.press(getByText('Upload to Strava'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Strava Not Connected', expect.any(String), expect.any(Array));
    });
    expect(mockUploadSessionToProvider).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('uploads a workout to Apple Health from the summary screen', async () => {
    const uploadedUpload = {
      id: 'upload-2',
      sessionId: 'session-1',
      providerId: 'apple_health',
      uploadState: 'uploaded' as const,
      externalId: 'workout-uuid',
      errorMessage: null,
      createdAtMs: 100,
      updatedAtMs: 200,
    };
    const appleCalls: number[] = [];
    mockGetProviderUpload.mockImplementation((_sessionId: string, providerId: string) => {
      if (providerId !== 'apple_health') return null;
      appleCalls.push(1);
      return appleCalls.length === 1 ? null : uploadedUpload;
    });
    mockUploadSessionToProvider.mockResolvedValue({
      providerId: 'apple_health',
      success: true,
      externalId: 'workout-uuid',
    });

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const { getByText } = render(
      <TrainingSummaryScreen
        sessionId="session-1"
        source={SAVED_SESSION_TRAINING_SUMMARY_SOURCE}
        returnTo="/history"
      />,
    );

    fireEvent.press(getByText('Upload to Apple Health'));

    await waitFor(() => {
      expect(mockUploadSessionToProvider).toHaveBeenCalledWith('session-1', 'apple_health');
    });
    expect(getByText('Apple Health Uploaded')).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith('Saved to Apple Health', 'This workout was saved to Apple Health.');

    alertSpy.mockRestore();
  });

  it('shows a not-connected alert when Apple Health upload is tapped without connection', async () => {
    mockAppleHealthGetState.mockReturnValue({ connected: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    const { getByText } = render(
      <TrainingSummaryScreen
        sessionId="session-1"
        source={SAVED_SESSION_TRAINING_SUMMARY_SOURCE}
        returnTo="/history"
      />,
    );

    fireEvent.press(getByText('Upload to Apple Health'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Apple Health Not Connected', expect.any(String), expect.any(Array));
    });
    expect(mockUploadSessionToProvider).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('shows a retry state when the latest Strava upload failed', () => {
    mockGetProviderUpload.mockReturnValue({
      id: 'upload-1',
      sessionId: 'session-1',
      providerId: 'strava',
      uploadState: 'failed',
      externalId: null,
      errorMessage: 'Rate limited',
      createdAtMs: 100,
      updatedAtMs: 200,
    });

    const { getByText } = render(
      <TrainingSummaryScreen
        sessionId="session-1"
        source={SAVED_SESSION_TRAINING_SUMMARY_SOURCE}
        returnTo="/history"
      />,
    );

    expect(getByText('Retry Strava')).toBeTruthy();
    expect(getByText('Strava upload failed: Rate limited')).toBeTruthy();
  });
});
