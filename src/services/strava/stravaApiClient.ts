import { Paths, type File } from 'expo-file-system';

import { STRAVA_UPLOAD_URL } from './stravaConstants';
import type { StravaUploadResponse, StravaUploadResult } from './types';

const STRAVA_SPORT_TYPE = 'VirtualRide';
const STRAVA_DATA_TYPE = 'tcx';
const STRAVA_TCX_MIME_TYPE = 'application/vnd.garmin.tcx+xml';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15;
const STRAVA_UPLOAD_FILE_PREFIX = 'strava-upload';

function logStravaRequest(message: string, payload: Record<string, unknown>): void {
  if (!__DEV__) {
    return;
  }

  console.warn(`[stravaApiClient] ${message}`, payload);
}

function createUploadFile(tcxData: string, externalId: string): File {
  const safeExternalId = externalId.replaceAll(/[^a-zA-Z0-9._-]/g, '-');
  const file = Paths.cache.createFile(`${STRAVA_UPLOAD_FILE_PREFIX}-${safeExternalId}`, STRAVA_TCX_MIME_TYPE);

  file.write(tcxData);

  return file;
}

/**
 * Uploads a TCX file to Strava as a new activity.
 * Returns the upload object including the upload id used for polling.
 */
export async function uploadActivity(
  accessToken: string,
  tcxData: string,
  activityName: string,
  externalId: string,
): Promise<StravaUploadResponse> {
  const uploadFile = createUploadFile(tcxData, externalId);
  const form = new FormData();

  form.append('data_type', STRAVA_DATA_TYPE);
  form.append('sport_type', STRAVA_SPORT_TYPE);
  form.append('name', activityName);
  form.append('trainer', '1');
  form.append('external_id', externalId);
  form.append('file', {
    uri: uploadFile.uri,
    name: uploadFile.name,
    type: STRAVA_TCX_MIME_TYPE,
  } as unknown as Blob);

  try {
    logStravaRequest('Uploading activity to Strava', {
      url: STRAVA_UPLOAD_URL,
      method: 'POST',
      dataType: STRAVA_DATA_TYPE,
      sportType: STRAVA_SPORT_TYPE,
      trainer: '1',
      externalId,
      activityName,
      fileName: uploadFile.name,
    });

    const response = await fetch(STRAVA_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`[stravaApiClient] Upload failed (${response.status}): ${text}`);
    }

    return (await response.json()) as StravaUploadResponse;
  } finally {
    try {
      uploadFile.delete();
    } catch (err: unknown) {
      console.error('[stravaApiClient] Failed to delete temporary upload file:', err);
    }
  }
}

/**
 * Polls a single upload status from Strava.
 */
export async function pollUploadStatus(accessToken: string, uploadId: number): Promise<StravaUploadResponse> {
  logStravaRequest('Polling Strava upload status', {
    url: `${STRAVA_UPLOAD_URL}/${uploadId}`,
    method: 'GET',
    uploadId,
  });

  const response = await fetch(`${STRAVA_UPLOAD_URL}/${uploadId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[stravaApiClient] Poll failed (${response.status}): ${text}`);
  }

  return (await response.json()) as StravaUploadResponse;
}

/**
 * Extracts an activity id from a Strava duplicate-upload error string.
 * Strava returns errors like: "There was an activity with this file uploaded on April 13, 2026. Activity Id: 12345678"
 * The pattern anchors to the word "activity" to skip any date numbers that precede the id.
 * Returns null if no id can be parsed.
 */
function extractDuplicateActivityId(errorMessage: string): number | null {
  const match = /activity\s+(?:id[:\s]+)?(\d+)/i.exec(errorMessage);

  if (!match?.[1]) return null;

  const id = Number(match[1]);

  return Number.isFinite(id) ? id : null;
}

/**
 * Polls until Strava finishes processing the upload or the max attempts are reached.
 * Handles duplicate detection by treating it as a success with the existing activity id.
 */
export async function waitForProcessing(accessToken: string, uploadId: number): Promise<StravaUploadResult> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    const status = await pollUploadStatus(accessToken, uploadId);

    logStravaRequest('Received Strava upload status', {
      uploadId,
      attempt: attempt + 1,
      activityId: status.activity_id,
      status: status.status,
      error: status.error,
    });

    if (status.activity_id !== null && status.activity_id !== undefined) {
      return { activityId: status.activity_id, error: null };
    }

    if (status.error) {
      if (status.error.toLowerCase().includes('duplicate')) {
        const activityId = extractDuplicateActivityId(status.error);
        // Only treat as success when we can recover the existing activity id.
        // If the id can't be parsed, surface the duplicate message so the user can retry.
        if (activityId !== null) {
          return { activityId, error: null };
        }
      }
      return { activityId: null, error: status.error };
    }

    // status.status === 'Your activity is being processed.' — keep polling
  }

  return { activityId: null, error: 'Upload processing timed out after maximum poll attempts.' };
}
