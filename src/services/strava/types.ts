export interface StravaAthlete {
  id: number;
  firstName: string;
  lastName: string;
}

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix timestamp (seconds) when the access token expires. */
  expiresAt: number;
  athlete: StravaAthlete;
}

export interface StravaUploadResponse {
  id: number;
  /** Processing status string returned by Strava. */
  status: string;
  error: string | null;
  /** Populated once Strava finishes processing the upload. */
  activity_id: number | null;
}

export interface StravaUploadResult {
  activityId: number | null;
  error: string | null;
}

/** Raw token response shape returned by Strava's token and refresh endpoints. */
export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: {
    id: number;
    firstname: string;
    lastname: string;
  };
}
