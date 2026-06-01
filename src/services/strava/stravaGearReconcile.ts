import { STRAVA_RECONNECT_ERROR_MARKER } from './stravaConstants';

export interface StravaGearFailure {
  linkInvalid: boolean;
  message: string;
}

/**
 * A gear-attach failure invalidates the local link only when Strava reports a gear-resource
 * problem. Activity-resource problems (e.g. missing private-edit scope) leave the link intact.
 */
function indicatesStaleGearLink(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase();

  if (lower.includes('"resource":"activity"') || lower.includes('private activity edit access')) {
    return false;
  }

  return lower.includes('"resource":"gear"') || lower.includes('gear_id') || lower.includes('gear not found');
}

/**
 * Classify a Strava gear-reconciliation failure into a provider-agnostic outcome.
 * Pure: the orchestrator never sees Strava error bodies or copy.
 */
export function classifyStravaGearFailure(args: { isClear: boolean; rawMessage: string }): StravaGearFailure {
  const { isClear, rawMessage } = args;
  const reconnect = rawMessage.includes(STRAVA_RECONNECT_ERROR_MARKER);

  if (isClear) {
    return {
      linkInvalid: false,
      message: reconnect
        ? 'Workout uploaded, but Strava could not clear its default bike. Reconnect Strava once, then try again.'
        : 'Workout uploaded, but Strava may still apply its default bike. Check your Strava gear settings.',
    };
  }

  return {
    linkInvalid: indicatesStaleGearLink(rawMessage),
    message: reconnect
      ? 'Workout uploaded, but Strava could not attach the linked bike. Reconnect Strava once, then try again.'
      : 'Workout uploaded, but the linked bike could not be attached. Relink it in Settings.',
  };
}
