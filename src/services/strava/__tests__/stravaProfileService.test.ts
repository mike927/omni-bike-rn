import { getValidAccessToken } from '../stravaAuthService';
import { loadProfileFromStrava } from '../stravaProfileService';

jest.mock('../stravaAuthService', () => ({
  getValidAccessToken: jest.fn(),
}));

jest.mock('../stravaConstants', () => ({
  STRAVA_API_URL: 'https://www.strava.com/api/v3',
}));

const mockGetValidAccessToken = getValidAccessToken as jest.MockedFunction<typeof getValidAccessToken>;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  mockGetValidAccessToken.mockResolvedValue('access-token');
});

describe('loadProfileFromStrava', () => {
  it('maps Strava sex M/F to canonical male/female and forwards weight in kg', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, firstname: 'A', lastname: 'B', sex: 'M', weight: 78.5 }),
    });
    await expect(loadProfileFromStrava()).resolves.toEqual({ sex: 'male', weightKg: 78.5 });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, firstname: 'A', lastname: 'B', sex: 'F', weight: 60 }),
    });
    await expect(loadProfileFromStrava()).resolves.toEqual({ sex: 'female', weightKg: 60 });
  });

  it('omits sex and weight when Strava returns null or unrecognized values', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, firstname: 'A', lastname: 'B', sex: null, weight: null }),
    });
    await expect(loadProfileFromStrava()).resolves.toEqual({});

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, firstname: 'A', lastname: 'B', sex: 'X', weight: 0 }),
    });
    await expect(loadProfileFromStrava()).resolves.toEqual({});
  });

  it('throws a reconnect-style error on 401/403', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });
    await expect(loadProfileFromStrava()).rejects.toThrow('Reconnect Strava');
  });

  it('throws a generic error on other non-OK responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, text: async () => 'oops' });
    await expect(loadProfileFromStrava()).rejects.toThrow('Failed to load athlete profile (500)');
  });
});
