import { STRAVA_UPLOAD_URL } from './stravaConstants';
import type { StravaUploadResponse, StravaUploadResult } from './types';

const STRAVA_ACTIVITY_TYPE = 'VirtualRide';
const STRAVA_DATA_TYPE = 'tcx';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15;

/**
 * Uploads a TCX file to Strava as a new activity.
 * Returns the upload object including the upload id used for polling.
 */
export async function uploadActivity(
  accessToken: string,
  tcxData: string,
  activityName: string,
): Promise<StravaUploadResponse> {
  const form = new FormData();
  form.append('data_type', STRAVA_DATA_TYPE);
  form.append('activity_type', STRAVA_ACTIVITY_TYPE);
  form.append('name', activityName);
  form.append('file', new Blob([tcxData], { type: 'application/xml' }), 'activity.tcx');

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
}

/**
 * Polls a single upload status from Strava.
 */
export async function pollUploadStatus(accessToken: string, uploadId: number): Promise<StravaUploadResponse> {
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

    if (status.activity_id !== null && status.activity_id !== undefined) {
      return { activityId: status.activity_id, error: null };
    }

    if (status.error) {
      // Strava signals duplicate uploads via an error string; treat as success.
      if (status.error.toLowerCase().includes('duplicate')) {
        const activityId = extractDuplicateActivityId(status.error);
        return { activityId, error: null };
      }
      return { activityId: null, error: status.error };
    }

    // status.status === 'Your activity is being processed.' — keep polling
  }

  return { activityId: null, error: 'Upload processing timed out after maximum poll attempts.' };
}
