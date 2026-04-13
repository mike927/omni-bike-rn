import { getValidAccessToken } from '../stravaAuthService';
import { attachStravaGearToActivity, listStravaGear } from '../stravaGearService';

jest.mock('../stravaAuthService', () => ({
  getValidAccessToken: jest.fn(),
}));

jest.mock('../stravaConstants', () => ({
  STRAVA_API_URL: 'https://www.strava.com/api/v3',
}));

const mockGetValidAccessToken = getValidAccessToken as jest.MockedFunction<typeof getValidAccessToken>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  global.fetch = jest.fn();
  mockGetValidAccessToken.mockResolvedValue('access-token');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('listStravaGear', () => {
  it('returns mapped bikes from the authenticated athlete profile', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        username: 'tester',
        firstname: 'Test',
        lastname: 'User',
        bikes: [
          { id: 'gear-1', name: 'Rave', primary: true },
          { id: 'gear-2', name: 'Road Bike', primary: false },
        ],
      }),
    });

    await expect(listStravaGear('bike')).resolves.toEqual([
      { providerId: 'strava', gearType: 'bike', id: 'gear-1', name: 'Rave', isPrimary: true },
      { providerId: 'strava', gearType: 'bike', id: 'gear-2', name: 'Road Bike', isPrimary: false },
    ]);

    expect(global.fetch).toHaveBeenCalledWith('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: 'Bearer access-token' },
    });
  });

  it('surfaces a reconnect message for permission failures', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    await expect(listStravaGear('bike')).rejects.toThrow('Reconnect Strava');
  });
});

describe('attachStravaGearToActivity', () => {
  it('updates the uploaded activity with the selected gear id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await attachStravaGearToActivity('12345', 'gear-1');

    expect(global.fetch).toHaveBeenCalledWith('https://www.strava.com/api/v3/activities/12345', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gear_id: 'gear-1' }),
    });
  });

  it('throws when Strava rejects the gear attach request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not found',
    });

    await expect(attachStravaGearToActivity('12345', 'gear-1')).rejects.toThrow('404');
  });

  it('retries activity-not-found responses before succeeding', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () =>
          '{"message":"Resource Not Found","errors":[{"resource":"Activity","field":"","code":"not found"}]}',
      })
      .mockResolvedValueOnce({ ok: true });

    const promise = attachStravaGearToActivity('12345', 'gear-1');
    await jest.runAllTimersAsync();
    await promise;

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('surfaces a reconnect hint when Strava cannot access the uploaded activity', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () =>
        '{"message":"Resource Not Found","errors":[{"resource":"Activity","field":"","code":"not found"}]}',
    });

    const errorPromise = attachStravaGearToActivity('12345', 'gear-1').then(
      () => null,
      (error: unknown) => error,
    );
    await jest.runAllTimersAsync();

    const error = await errorPromise;

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('Reconnect Strava');
  });
});
