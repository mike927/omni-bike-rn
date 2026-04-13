import { pollUploadStatus, uploadActivity, waitForProcessing } from '../stravaApiClient';

jest.mock('../stravaConstants', () => ({
  STRAVA_UPLOAD_URL: 'https://www.strava.com/api/v3/uploads',
}));

const ACCESS_TOKEN = 'test-access-token';
const UPLOAD_ID = 12345;

class MockFormData {
  private entries: [string, unknown][] = [];
  append(key: string, value: unknown) {
    this.entries.push([key, value]);
  }
  getEntries() {
    return this.entries;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  global.fetch = jest.fn();
  global.FormData = MockFormData as unknown as typeof FormData;
  global.Blob = jest
    .fn()
    .mockImplementation((parts: unknown[], options: unknown) => ({ parts, options })) as unknown as typeof Blob;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('uploadActivity', () => {
  it('sends a POST with Authorization header and returns upload response', async () => {
    const mockResponse: Record<string, unknown> = {
      id: UPLOAD_ID,
      status: 'Your activity is being processed.',
      error: null,
      activity_id: null,
    };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockResponse });

    const result = await uploadActivity(ACCESS_TOKEN, '<tcx/>', 'Indoor Cycling - Apr 13, 2026');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.strava.com/api/v3/uploads',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      }),
    );
    expect(result.id).toBe(UPLOAD_ID);
  });

  it('throws when the server returns a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 422, text: async () => 'Unprocessable' });
    await expect(uploadActivity(ACCESS_TOKEN, '<tcx/>', 'name')).rejects.toThrow('422');
  });
});

describe('pollUploadStatus', () => {
  it('GETs the upload status endpoint and returns parsed response', async () => {
    const mockResponse = { id: UPLOAD_ID, status: 'Your activity is being processed.', error: null, activity_id: null };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockResponse });

    const result = await pollUploadStatus(ACCESS_TOKEN, UPLOAD_ID);

    expect(global.fetch).toHaveBeenCalledWith(
      `https://www.strava.com/api/v3/uploads/${UPLOAD_ID}`,
      expect.objectContaining({ headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }),
    );
    expect(result.status).toBe('Your activity is being processed.');
  });

  it('throws when poll returns non-ok status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404, text: async () => 'Not found' });
    await expect(pollUploadStatus(ACCESS_TOKEN, UPLOAD_ID)).rejects.toThrow('404');
  });
});

describe('waitForProcessing', () => {
  it('returns activityId immediately when first poll has activity_id', async () => {
    const mockResponse = { id: UPLOAD_ID, status: 'Your activity is ready.', error: null, activity_id: 99999 };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockResponse });

    const promise = waitForProcessing(ACCESS_TOKEN, UPLOAD_ID);
    const result = await promise;

    expect(result.activityId).toBe(99999);
    expect(result.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('polls multiple times before resolving with activity_id', async () => {
    const processing = { id: UPLOAD_ID, status: 'Your activity is being processed.', error: null, activity_id: null };
    const ready = { id: UPLOAD_ID, status: 'Your activity is ready.', error: null, activity_id: 88888 };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => processing })
      .mockResolvedValueOnce({ ok: true, json: async () => processing })
      .mockResolvedValueOnce({ ok: true, json: async () => ready });

    const promise = waitForProcessing(ACCESS_TOKEN, UPLOAD_ID);
    // Advance timers for each polling interval
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.activityId).toBe(88888);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('returns duplicate activityId when Strava signals duplicate error', async () => {
    const duplicate = {
      id: UPLOAD_ID,
      status: 'There was an error processing your activity.',
      error: 'duplicate of activity 77777',
      activity_id: null,
    };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => duplicate });

    const promise = waitForProcessing(ACCESS_TOKEN, UPLOAD_ID);
    const result = await promise;

    expect(result.activityId).toBe(77777);
    expect(result.error).toBeNull();
  });

  it('returns error when Strava returns a non-duplicate error', async () => {
    const errored = { id: UPLOAD_ID, status: 'error', error: 'Invalid file format.', activity_id: null };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => errored });

    const result = await waitForProcessing(ACCESS_TOKEN, UPLOAD_ID);

    expect(result.activityId).toBeNull();
    expect(result.error).toBe('Invalid file format.');
  });

  it('returns timeout error after max poll attempts', async () => {
    const processing = { id: UPLOAD_ID, status: 'Your activity is being processed.', error: null, activity_id: null };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => processing });

    const promise = waitForProcessing(ACCESS_TOKEN, UPLOAD_ID);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.activityId).toBeNull();
    expect(result.error).toContain('timed out');
  });
});
