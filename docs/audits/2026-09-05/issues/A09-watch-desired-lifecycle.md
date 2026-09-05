# A09 — Watch asynchronous transitions discard newer lifecycle intent

[Audit index](../README.md) · Baseline: `965cbec` · Audit date: 2026-09-05

## Tracking

| Field | Value |
| --- | --- |
| Status | In progress |
| Owner | automated remediation agent |
| Branch / PR | `fix/a09-watch-desired-lifecycle` / [PR #116](https://github.com/mike927/omni-bike-rn/pull/116) |
| Last updated | 2026-09-05 |
| Type | Bug |
| Category | correctness |
| Severity | Medium |
| Priority | P2 — Planned |
| Evidence | Confirmed — static callback-ordering defects; physical frequency unmeasured |
| Estimated effort | Medium |

## Dependencies and coordination

Independent Watch-side fix; coordinate the intended pause semantics with A06.

Read the [tracker workflow](../README.md#working-an-issue) and repository `AGENTS.md` before claiming. Follow the existing Superpowers workflow when implementing; this ticket records an audit finding, not an approved detailed implementation design. Revalidate against the current revision before changing code.

## Source references

- [ios/OmniBikeWatch Watch App/WorkoutManager.swift](<../../../../ios/OmniBikeWatch Watch App/WorkoutManager.swift>) — audit lines/section 203–215, 223–237, 298–336, 554–569.
- [modules/watch-connectivity/ios/WatchConnectivityModule.swift](<../../../../modules/watch-connectivity/ios/WatchConnectivityModule.swift>) — audit lines/section 282–297.

Line references describe the audit baseline and may drift. Locate the named functions in the current tree.

## Problem

Pending Watch work is guarded by current state/in-flight flags without retaining the latest desired lifecycle intent. Two callback orderings expose this shared ownership problem.

## Triggering scenario

1. Pause starts an HK transition; Resume arrives before the callback and is discarded by pauseResumeInFlight.
2. Start awaits authorization; Stop arrives while session is nil; authorization then succeeds.

## Expected versus observed / evidence

In sequence 1 the paused callback clears the guard without applying Resume, leaving Watch paused while the phone is Active. In sequence 2 authorization starts a Watch workout after the ride ended. Expected: the latest valid phone intent wins. These are static traces, not executed native reproductions.



## Impact and triage

Medium/P2: affected ordering can stop Watch HR/calories or leave an orphan workout. Timing requirements limit likelihood and manual recovery generally exists.

## Smallest sound correction or improvement

Retain desired lifecycle state and a start generation. Reconcile running/paused intent after transition completion. Stop invalidates pending authorization/start even without an existing session. Keep duplicate-transition protection rather than simply deleting the interlock.

## Acceptance criteria and verification

- [x] Control native callbacks for pause → resume → paused callback and the reverse sequence.
- [x] Delay authorization, issue Stop, then succeed authorization; no workout may start.
- [ ] Cover duplicate starts, a genuinely later start, Stop superseding pending transitions, and delayed transport delivery on devices.
- [x] Run relevant existing checks following `AGENTS.md`; record exact commands, results and verification limits below.
- [x] Update status, owner, last-updated date and completion evidence; coordinate the aggregate roadmap state as described in the index.

The first two are ticked against **executed, controlled orderings of the extracted decision model** (`npm run test:watch-lifecycle`), not against live HealthKit callbacks on a Watch. Duplicate starts, a later start and Stop superseding a pending transition are covered by the same checks; the third box stays open because it also requires delayed transport delivery on real hardware. The aggregate roadmap item is already `[~]` and needs no change while other tickets are open.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05 - Claimed and implemented on `fix/a09-watch-desired-lifecycle` (PR #116). Desired lifecycle state, start generation and command ordering extracted into a platform-free `WatchLifecycleModel`; `WorkoutManager` records intent first and reconciles after every settled transition; the iPhone module stamps every command with the intent's send time. Host-run checks added (`npm run test:watch-lifecycle`) and mutation-verified. Status stays In progress: on-device acceptance is outstanding.

## Completion / disposition record

**Change summary.** Branch `fix/a09-watch-desired-lifecycle`, commit `5efb25f`, [PR #116](https://github.com/mike927/omni-bike-rn/pull/116).

The Watch no longer infers what to do from whichever asynchronous callback lands last. It keeps the newest intent explicitly:

- **New `ios/OmniBikeWatch Watch App/WatchLifecycle.swift`.** `WatchLifecycleModel` holds `desired` (idle / running / paused), a `startGeneration` and the send stamp of the newest applied command, and answers two questions: may a start issued under generation *n* still open a session, and what single correction brings the session in line with the intent. No HealthKit, WatchConnectivity or WatchKit imports, so it compiles and runs on the Mac.
- **`WorkoutManager`.** Every command now flows through `applyCommand`, which records the intent first and then calls `reconcile()`. `reconcile()` also runs at the end of every settled `workoutSession(_:didChangeTo:from:date:)`, which is what applies an intent that arrived while a transition was still in flight (sequence 1). A stop retires the pending start generation even when `session` is nil, so a late authorization completion gives up rather than opening a workout for an ended ride (sequence 2). The duplicate-transition interlock is preserved and renamed `transitionInFlight`: it still allows at most one transition at a time, but now only defers a correction instead of discarding it. `WKApplicationDelegate.handle(_:)` and the WatchConnectivity `start` command share one entry point, `requestStart(configuration:)`, so both are cancelled by the same stop.
- **`modules/watch-connectivity/ios/WatchConnectivityModule.swift`.** Every iPhone to Watch command carries `sentAtMs`, stamped when the intent is formed rather than when the payload finally goes out (a start can sit queued behind reachability while later intents are already formed). The Watch orders commands by that stamp instead of by arrival, because `sendMessage` (reachable) and `transferUserInfo` (queued) can deliver out of order. An unstamped command still applies, so the unstamped HealthKit wake does not regress.
- **`AGENTS.md`.** New "Watch lifecycle intent" domain rule and a "Native lifecycle checks" dev-loop line.

**Executed commands and outcomes.**

| Command | Outcome |
| --- | --- |
| `npm run ci:gate` | Pass. lint, typecheck, 113 suites / 1128 tests. |
| `npm run test:watch-lifecycle` | Pass. 13 host-run lifecycle checks. |
| `swiftc -typecheck -sdk $(xcrun --sdk watchos --show-sdk-path) -target arm64_32-apple-watchos26.0 -swift-version 5 -default-isolation MainActor "ios/OmniBikeWatch Watch App/"*.swift` | Pass. Whole Watch app against the watchOS 26.5 SDK with the target's own Swift settings. |
| `swiftc -parse modules/watch-connectivity/ios/WatchConnectivityModule.swift` | Pass (syntax only). |

**Mutation evidence.** Each reversion below was applied to `WatchLifecycle.swift` alone and the checks re-run; every one turns a named check red, so no check passes against pre-fix behaviour.

| Reverted behaviour | Check that fails |
| --- | --- |
| Reconcile no longer resumes a paused session the phone wants running | "resume issued mid-transition is applied when the paused callback lands" |
| Stop no longer retires the pending start generation | "the authorization from the cancelled start stays retired" |
| Commands ordered by arrival instead of send stamp | 6 checks, including "the newer resume still owns the desired state" |
| A session still starting is not ended when the ride is cancelled | "a stop ends a session still starting" |
| The duplicate-transition interlock is deleted | "no second transition while one is in flight" |
| A later start no longer supersedes the pending one | "a second start supersedes the first" |

**Verification limits.**

- No `pod install` is possible in this checkout, so `WatchConnectivityModule.swift` is syntax-checked only, never type-checked against `ExpoModulesCore`, and neither app was built or launched.
- Nothing here was run on a paired Apple Watch. Outstanding device evidence: install the matched iPhone + Watch pair, then (a) pause and immediately resume from both the phone and the wrist and confirm the Watch ends running with HR flowing, (b) start a ride and cancel it before the Health prompt is answered and confirm no workout appears, (c) pause with the wrist down so the command queues, resume once reachable, and confirm the queued pause does not re-pause the Watch. Capture the Watch `wc.log` (`[WC-Watch] applyCommand` / `reconcile` lines) and the iPhone `wc.log` for each.

**Notes and follow-ups (not fixed here).**

- Adjacent, pre-existing and unchanged by this branch: a `start` that arrives while a session is being torn down (orphan recovery at launch, or a stop immediately followed by a new ride) is still dropped, because only a `start` creates a session and the teardown removes the one it found. The iPhone recovers within roughly one freshness window through the `useWatchHr` HR-drop watchdog. Left alone deliberately: an automatic restart from teardown risks looping against the `beginCollection` failure path.
- Command ordering by send stamp also narrows hypothesis [H01](../hypotheses.md) (a command queued for a previous ride delivered during a later one), since the older stamp is now ignored once any newer command has been applied. H01 is left untouched and still needs its own hardware validation.
- `npm run test:watch-lifecycle` is deliberately outside `ci:gate`: the GitHub gate runs on `ubuntu-latest`, which has no Swift toolchain. Adding a macOS job for it is a separate harness decision.
