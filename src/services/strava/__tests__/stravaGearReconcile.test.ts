import { classifyStravaGearFailure } from '../stravaGearReconcile';

describe('classifyStravaGearFailure', () => {
  describe('attach (desired gear present)', () => {
    it('marks the link invalid and asks for a relink on a gear-not-found error', () => {
      const result = classifyStravaGearFailure({ isClear: false, rawMessage: 'Gear not found (404)' });
      expect(result).toEqual({
        linkInvalid: true,
        message: 'Workout uploaded, but the linked bike could not be attached. Relink it in Settings.',
      });
    });

    it('marks the link invalid on a "resource":"gear" error body', () => {
      const result = classifyStravaGearFailure({
        isClear: false,
        rawMessage: '{"message":"Bad Request","errors":[{"resource":"gear","field":"gear_id"}]}',
      });
      expect(result.linkInvalid).toBe(true);
    });

    it('keeps the link intact and asks for reconnect on an activity-edit-access error', () => {
      const result = classifyStravaGearFailure({
        isClear: false,
        rawMessage: 'Reconnect Strava to grant private activity edit access.',
      });
      expect(result).toEqual({
        linkInvalid: false,
        message:
          'Workout uploaded, but Strava could not attach the linked bike. Reconnect Strava once, then try again.',
      });
    });
  });

  describe('clear (no desired gear)', () => {
    it('never marks a link invalid and asks for reconnect when the marker is present', () => {
      const result = classifyStravaGearFailure({
        isClear: true,
        rawMessage: 'Reconnect Strava to grant private activity edit access.',
      });
      expect(result).toEqual({
        linkInvalid: false,
        message:
          'Workout uploaded, but Strava could not clear its default bike. Reconnect Strava once, then try again.',
      });
    });

    it('falls back to the gear-settings hint on a generic clear failure', () => {
      const result = classifyStravaGearFailure({ isClear: true, rawMessage: 'Internal Server Error (500)' });
      expect(result).toEqual({
        linkInvalid: false,
        message: 'Workout uploaded, but Strava may still apply its default bike. Check your Strava gear settings.',
      });
    });
  });
});
