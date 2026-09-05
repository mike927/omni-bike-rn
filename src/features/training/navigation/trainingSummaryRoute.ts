export const POST_FINISH_TRAINING_SUMMARY_SOURCE = 'post-finish';
export const SAVED_SESSION_TRAINING_SUMMARY_SOURCE = 'saved-session';

export type TrainingSummarySource =
  typeof POST_FINISH_TRAINING_SUMMARY_SOURCE | typeof SAVED_SESSION_TRAINING_SUMMARY_SOURCE;

const SUMMARY_ROUTE_PATH = '/summary';

export function buildTrainingSummaryRoute(sessionId: string, source: TrainingSummarySource, returnTo?: string): string {
  const encodedSessionId = encodeURIComponent(sessionId);
  const encodedReturnTo = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : '';

  return `${SUMMARY_ROUTE_PATH}?sessionId=${encodedSessionId}&source=${source}${encodedReturnTo}`;
}

/** Where the app lands when a ride ends without a saved session to show. */
export const POST_FINISH_HOME_ROUTE = '/';

/**
 * Route to replace the current screen with once a ride is finished: its summary,
 * or Home when nothing was persisted. Shared so the on-screen Finish button and
 * the root-owned Watch remote land in the same place.
 */
export function resolvePostFinishRoute(sessionId: string | null): string {
  return sessionId
    ? buildTrainingSummaryRoute(sessionId, POST_FINISH_TRAINING_SUMMARY_SOURCE, POST_FINISH_HOME_ROUTE)
    : POST_FINISH_HOME_ROUTE;
}

export function resolveTrainingSummarySource(source: string | string[] | undefined): TrainingSummarySource {
  if (source === POST_FINISH_TRAINING_SUMMARY_SOURCE) {
    return POST_FINISH_TRAINING_SUMMARY_SOURCE;
  }

  return SAVED_SESSION_TRAINING_SUMMARY_SOURCE;
}

export function resolveTrainingSummaryReturnTo(returnTo: string | string[] | undefined): string | null {
  if (typeof returnTo !== 'string') {
    return null;
  }

  return returnTo.startsWith('/') ? returnTo : null;
}

export function shouldShowSummaryHeaderBack(source: TrainingSummarySource): boolean {
  return source !== POST_FINISH_TRAINING_SUMMARY_SOURCE;
}
