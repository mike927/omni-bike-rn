import { impliedActiveSeconds, toWorkoutEvents } from '../workoutPauseEvents';

const START_MS = 1_700_000_000_000;
const END_MS = START_MS + 1_800_000;

describe('toWorkoutEvents', () => {
  it('maps a pause and resume pair in order', () => {
    expect(
      toWorkoutEvents(
        [
          { kind: 'pause', atMs: START_MS + 600_000 },
          { kind: 'resume', atMs: START_MS + 1_200_000 },
        ],
        START_MS,
        END_MS,
      ),
    ).toEqual([
      { type: 'pause', timestampMs: START_MS + 600_000 },
      { type: 'resume', timestampMs: START_MS + 1_200_000 },
    ]);
  });

  it('keeps a trailing pause, which is a ride finished while paused', () => {
    expect(toWorkoutEvents([{ kind: 'pause', atMs: START_MS + 600_000 }], START_MS, END_MS)).toEqual([
      { type: 'pause', timestampMs: START_MS + 600_000 },
    ]);
  });

  it('returns nothing for a ride recorded without a pause', () => {
    expect(toWorkoutEvents([], START_MS, END_MS)).toEqual([]);
  });

  it('exports a ride with an unknown pause history as one continuous effort', () => {
    // `null` and `[]` are, and must stay, indistinguishable here: a ride whose
    // history is unknown has to export exactly like a ride that was never
    // paused. So what this binds is not the difference between them, it is that
    // the nullable input is tolerated at all and carries through to a full
    // window of effort. The NULL-versus-empty rule is load-bearing in the
    // repository, where it decides whether a history may be appended to, and it
    // is bound there rather than here.
    const fromUnknown = toWorkoutEvents(null, START_MS, END_MS);

    expect(fromUnknown).toEqual([]);
    expect(toWorkoutEvents(undefined, START_MS, END_MS)).toEqual([]);
    expect(impliedActiveSeconds(fromUnknown, START_MS, END_MS)).toBe(1800);
  });

  it('drops events outside the workout window', () => {
    expect(
      toWorkoutEvents(
        [
          { kind: 'pause', atMs: START_MS - 1 },
          { kind: 'pause', atMs: START_MS + 600_000 },
          { kind: 'resume', atMs: END_MS + 1 },
        ],
        START_MS,
        END_MS,
      ),
    ).toEqual([{ type: 'pause', timestampMs: START_MS + 600_000 }]);
  });

  it('drops a resume that ends an interval which never began', () => {
    expect(
      toWorkoutEvents(
        [
          { kind: 'resume', atMs: START_MS + 100 },
          { kind: 'pause', atMs: START_MS + 600_000 },
          { kind: 'resume', atMs: START_MS + 900_000 },
          { kind: 'resume', atMs: START_MS + 950_000 },
        ],
        START_MS,
        END_MS,
      ),
    ).toEqual([
      { type: 'pause', timestampMs: START_MS + 600_000 },
      { type: 'resume', timestampMs: START_MS + 900_000 },
    ]);
  });

  it('orders events by time regardless of stored order', () => {
    expect(
      toWorkoutEvents(
        [
          { kind: 'resume', atMs: START_MS + 900_000 },
          { kind: 'pause', atMs: START_MS + 600_000 },
        ],
        START_MS,
        END_MS,
      ),
    ).toEqual([
      { type: 'pause', timestampMs: START_MS + 600_000 },
      { type: 'resume', timestampMs: START_MS + 900_000 },
    ]);
  });
});

describe('impliedActiveSeconds', () => {
  it('is the whole window when nothing was paused', () => {
    expect(impliedActiveSeconds([], START_MS, END_MS)).toBe(1800);
  });

  it('excludes a closed paused interval', () => {
    const events = toWorkoutEvents(
      [
        { kind: 'pause', atMs: START_MS + 600_000 },
        { kind: 'resume', atMs: START_MS + 1_800_000 },
      ],
      START_MS,
      START_MS + 2_400_000,
    );

    expect(impliedActiveSeconds(events, START_MS, START_MS + 2_400_000)).toBe(1200);
  });

  it('excludes a paused interval that runs to the end of the ride', () => {
    // The ticket's scenario: ten active minutes, then twenty paused, then Finish.
    const events = toWorkoutEvents([{ kind: 'pause', atMs: START_MS + 600_000 }], START_MS, END_MS);

    expect(impliedActiveSeconds(events, START_MS, END_MS)).toBe(600);
  });
});
