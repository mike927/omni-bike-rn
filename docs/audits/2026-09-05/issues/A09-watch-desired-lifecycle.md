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

The first two are ticked against **executed, controlled orderings of the extracted decision model** (`npm run test:watch-lifecycle`), not against live HealthKit callbacks on a Watch. Both directions of criterion 1 now have their own named check: `pauseThenResumeBeforeThePausedCallback` and `resumeThenPauseBeforeTheRunningCallback`. Duplicate starts, a later start and Stop superseding a pending transition are covered by the same checks; the third box stays open because it also requires delayed transport delivery on real hardware. The aggregate roadmap item is already `[~]` and needs no change while other tickets are open.

The checks cover the **decision model only**. The `applyCommand` / `reconcile` / `didChangeTo` wiring in `WorkoutManager` (including the `endIssued` latch and the session-identity guard) has no executable coverage: it is HealthKit-coupled and only the device pass can exercise it.

## Work log

- 2026-09-05 — Imported from the audit of `965cbec`. No remediation performed; status is Not started.
- 2026-09-05 - Claimed and implemented on `fix/a09-watch-desired-lifecycle` (PR #116). Desired lifecycle state, start generation and command ordering extracted into a platform-free `WatchLifecycleModel`; `WorkoutManager` records intent first and reconciles after every settled transition; the iPhone module stamps every command with the intent's send time. Host-run checks added (`npm run test:watch-lifecycle`) and mutation-verified. Status stays In progress: on-device acceptance is outstanding.
- 2026-09-05 - Review round 1 (`CHANGES_REQUIRED`) addressed on the same branch. `end()` no longer waits behind the pause/resume interlock, which had made an unsettled transition able to strand a live `HKWorkoutSession`; the two load-bearing but uncovered ordering guards now have named checks; the mutation claim, the residual risks and two false `AGENTS.md` statements are corrected below. Status stays In progress: on-device acceptance is still outstanding.
- 2026-09-05 - Re-review (`ALL_ADDRESSED`) follow-ups applied on the same branch. The re-review cleared the unendable-workout risk and found one coverage regression this diff had introduced (the pause side of the interlock lost its check when the single guard was split into two per-branch ternaries) plus one uncovered ordering property. Both now have checks, `workoutSession(_:didFailWithError:)` gained the ownership guard `didChangeTo` already had, and the removal of base's implicit end-retry is written down below. Status stays In progress: on-device acceptance is still outstanding.

## Completion / disposition record

**Change summary.** Branch `fix/a09-watch-desired-lifecycle`, commit `5efb25f`, [PR #116](https://github.com/mike927/omni-bike-rn/pull/116).

The Watch no longer infers what to do from whichever asynchronous callback lands last. It keeps the newest intent explicitly:

- **New `ios/OmniBikeWatch Watch App/WatchLifecycle.swift`.** `WatchLifecycleModel` holds `desired` (idle / running / paused), a `startGeneration` and the send stamp of the newest applied command, and answers two questions: may a start issued under generation *n* still open a session, and what single correction brings the session in line with the intent. No HealthKit, WatchConnectivity or WatchKit imports, so it compiles and runs on the Mac.
- **`WorkoutManager`.** Every command now flows through `applyCommand`, which records the intent first and then calls `reconcile()`. `reconcile()` also runs at the end of every settled `workoutSession(_:didChangeTo:from:date:)`, which is what applies an intent that arrived while a transition was still in flight (sequence 1). A stop retires the pending start generation even when `session` is nil, so a late authorization completion gives up rather than opening a workout for an ended ride (sequence 2). The duplicate-transition interlock is preserved and renamed `transitionInFlight`: it allows at most one pause or resume at a time, and only defers a correction instead of discarding it. `WKApplicationDelegate.handle(_:)` and the WatchConnectivity `start` command share one entry point, `requestStart(configuration:)`, so both are cancelled by the same stop.
- **Ending is exempt from the interlock** (review round 1). `end()` is valid from every state the session can be in here, and gating it meant a pause or resume whose HealthKit callback never landed would leave a live `HKWorkoutSession` on the wrist that no command from either device could stop. A separate one-way `endIssued` latch, cleared with the session by `teardownSession`, keeps the end itself from being issued twice and defers a pause or resume once the end is on its way. `recoverOrphanedSession` arms that latch instead of the interlock, so an orphan whose `.ended` callback never lands no longer wedges pause/resume for the whole app launch, and both HealthKit session callbacks now ignore a session the manager no longer owns rather than releasing the interlock or tearing down the session that replaced it: `didChangeTo` from review round 1, and `workoutSession(_:didFailWithError:)` after the re-review, which had been the last shape in which a stale session's callback could drop our only reference to a live workout.
- **`modules/watch-connectivity/ios/WatchConnectivityModule.swift`.** Every iPhone to Watch command carries `sentAtMs`, stamped when the intent is formed rather than when the payload finally goes out (a start can sit queued behind reachability while later intents are already formed). The Watch orders commands by that stamp instead of by arrival, because `sendMessage` (reachable) and `transferUserInfo` (queued) can deliver out of order. An unstamped command still applies, so the unstamped HealthKit wake does not regress.
- **`AGENTS.md`.** New "Watch lifecycle intent" domain rule and a "Native lifecycle checks" dev-loop line. Corrected in review round 1: the rule had claimed that commands are ordered by send stamp "never by arrival" (false for the unstamped HealthKit wake) and that any command that cannot act "still records its intent for the next reconcile" (false for `start`, whose recorded intent can never be acted on because `reconcile` never creates a session).
- **`package.json`.** `test:watch-lifecycle` compiles with the shipping target's `-default-isolation MainActor`, builds into a `mktemp` directory it removes afterwards instead of a fixed `/tmp` path shared across worktrees, and is wired into `lint-staged` for `ios/OmniBikeWatch Watch App/*.swift`, so the check is machine-enforced pre-commit rather than only described in prose.

**Executed commands and outcomes.**

| Command | Outcome |
| --- | --- |
| `npm run ci:gate` | Pass. lint, typecheck, 113 suites / 1128 tests. |
| `npm run test:watch-lifecycle` | Pass. 19 host-run lifecycle checks, 59 assertions. |
| `swiftc -typecheck -sdk $(xcrun --sdk watchos --show-sdk-path) -target arm64_32-apple-watchos26.0 -swift-version 5 -default-isolation MainActor "ios/OmniBikeWatch Watch App/"*.swift` | Pass. Whole Watch app against the watchOS 26.5 SDK with the target's own Swift settings. |
| Same, plus `-enable-upcoming-feature MemberImportVisibility` (the target sets it) | Pass. |
| Same, plus `-strict-concurrency=complete`, against base `3f2f839` and against HEAD | 38 diagnostics on both: the branch adds none. |
| Full typecheck of `modules/watch-connectivity/ios/WatchConnectivityModule.swift` against the iphonesimulator SDK with a stubbed `ExpoModulesCore` | Pass, 0 errors and 0 warnings. |

**Mutation evidence.** Each reversion below was applied to a copy of `WatchLifecycle.swift` and the checks re-run against it. Round 1 enumerated only the six behaviours the implementer had in mind and claimed "no check passes against pre-fix behaviour"; the review found three surviving guards, two of them load-bearing. The list below is the battery as it stands after the re-review: 20 mutations, all red, with the unmutated control green. The last two are the coverage gaps the re-review found in round 2's own diff. It is still an enumeration, not a proof of completeness, and it covers the decision model only.

| Reverted behaviour | Result |
| --- | --- |
| Reconcile no longer resumes a paused session the phone wants running | Red (2) |
| Stop no longer retires the pending start generation | Red (4) |
| Commands ordered by arrival instead of send stamp | Red (15) |
| A session still starting is not ended when the ride is cancelled | Red (2) |
| The pause/resume interlock is deleted | Red (2) |
| A later start no longer supersedes the pending one | Red (2) |
| `record(.start)` drops `guard desired != .idle` (**round-1 survivor**) | Red (1): "a start older than the stop that ended the ride opens no session" |
| `record(.stop)` drops `guard isNewest` (**round-1 survivor**) | Red (4), including "the previous ride's queued stop does not retire the current ride's pending start" |
| An unstamped command is treated as stale | Red (26) |
| An ended session can be acted on (two shapes) | Red (1) and Red (2) |
| `end()` gated by the interlock again, as in round 1 | Red (3): "a stop ends a running / paused / starting session even while a transition is in flight" |
| `mayStart` always true | Red (5) |
| A pause or resume always reports its intent applied | Red (2) |
| Ordering by `>=` instead of `>`, so a duplicate delivery counts as newer | Red (3) |
| An unstamped command clears the ordering mark | Red (1) |
| A stop hands back a start generation | Red (1) |
| A session still starting is ended whatever the intent | Red (2) |
| The pause side of the interlock flattened to a bare `.pause` (**re-review survivor S1**) | Red (1): "no second transition while the pause is in flight" |
| The ordering mark written outside the `isNewest` guard, so a stale stamp lowers it (**re-review survivor S2**) | Red (4), including "a stale stamped command does not lower the ordering mark" |

The third round-1 survivor, `mayStart`'s redundant `desired != .idle` clause, was removed rather than covered: a stop that is not the newest command moves neither the generation nor the desired state, so a current generation can never coexist with an idle intent.

**Verification limits.**

- `WatchConnectivityModule.swift` is type-checked against a stubbed `ExpoModulesCore` (`Module`, `AnyModule`, `ModuleDefinition`, `ModuleDefinitionBuilder`, `Promise`, `Name`, `Events`, `OnCreate`, `AsyncFunction`), not against the real `ExpoModulesCore.xcframework`: `ios/Pods` does not exist in this checkout. Neither app was built or launched by Xcode.
- Nothing here was run on a paired Apple Watch. Outstanding device evidence: install the matched iPhone + Watch pair, then (a) pause and immediately resume from both the phone and the wrist and confirm the Watch ends running with HR flowing, (b) start a ride and cancel it before the Health prompt is answered and confirm no workout appears, (c) pause with the wrist down so the command queues, resume once reachable, and confirm the queued pause does not re-pause the Watch, and (d) end a ride within a fraction of a second of pausing it, so the stop lands while the pause is still settling, and confirm the Watch ends the workout exactly once (`reconcile: ending` appears once, `didChangeTo 3` follows, no `didFailWithError`). Capture the Watch `wc.log` (`[WC-Watch] applyCommand` / `reconcile` lines) and the iPhone `wc.log` for each.

**Notes and follow-ups (not fixed here).**

- **A `start` arriving during teardown is now dropped deterministically, where it used to be dropped intermittently.** This branch changed its character, so the earlier "pre-existing and unchanged" wording was wrong. Before, the decision was taken at the authorization completion, after a `requestAuthorization` round trip and a queue hop, so `startWorkout`'s `session != nil` check often ran once the teardown had already cleared `session` and the start landed. Now `applyCommand` evaluates `session == nil` synchronously at command time, and `reconcile()` by design never creates a session, so in that window the start never lands. The window is orphan recovery at launch, or a stop immediately followed by a new ride. The iPhone recovers within roughly one freshness window through the `useWatchHr` HR-drop watchdog. Left unfixed deliberately: an automatic restart from teardown risks looping against the `beginCollection` failure path, which ends the session it has just created.
- **The unstamped HealthKit wake can still start a workout for a ride that was already stopped.** Same defect family as A09 itself: `WKApplicationDelegate.handle(_:)` carries no payload of ours and therefore no `sentAtMs`, an unstamped command is always treated as newest, so a wake delivered after a stop overrides that stop. Left unfixed on purpose, and the reasoning matters because the obvious narrower rules are all wrong. The wake is not a redundant path but usually the *only* start path: `WCSession.isReachable` is false while the Watch app runs in the background without an active workout, and the stamped `start` is only flushed when reachable, so ignoring an unstamped start whenever the desired state is idle would break ride start in the ordinary "Watch asleep, tap Start" flow. Ignoring it only when a stamped stop has already been applied in this launch breaks a real sequence too: ride N-1 ends while unreachable, ride N starts, and the queued ride-N-1 stop and the ride-N wake are delivered in the same launch. The window also needs the queued stop to beat `handle(_:)` within one launch; in the other, more common ordering the new code cleans up correctly (the wake starts, the stop then applies, and `reconcile` ends the session), and the orphan self-heals at the next launch through `recoverOrphanedSession`. A correct fix needs ride identity the wake cannot carry, realistically by having the Watch ask the phone whether a ride is live before honouring an unstamped wake, with a timeout fallback. That is a separate ticket.
- **A backwards jump in the iPhone's wall clock silently drops commands until it catches up.** `lastCommandSentAtMs` is a high-water mark, never reset between rides, and ordering is a strict `>`; a backward correction on the phone therefore makes every subsequent command look older, including `stop`, and a dropped stop leaves a live `HKWorkoutSession`. Phone-to-Watch clock skew is *not* a factor here (the mark is only ever written from a phone-supplied stamp, so the Watch never compares the two clocks), and `stop` cannot simply be exempted from ordering, because a stale ride-N-1 stop delivered during ride N must still be ignored. Today only the next Watch app launch's `recoverOrphanedSession` recovers from it.
- **`endIssued` removes base's implicit end-retry.** Base `stopWorkout()` called `session.end()` on every stop command, so a repeated stop re-issued the end and gave the user a second chance at ending a stuck session. The latch de-duplicates that, which is *required* once `.end` is exempt from the interlock (otherwise a stop landing mid-pause ends the session, and the pause's settling callback reconciles and ends it again). The retry it removes was also itself the invalid-transition shape that provokes `didFailWithError`, so the trade is judged net positive, but it should be read as a trade: the only end-retry affordance left is the next launch's `recoverOrphanedSession`, and if HealthKit delivers neither `.ended` nor `didFailWithError` after the end is issued, the latch and the session both stay set until the app relaunches. No live workout is stranded by that (the end was issued before the latch was set), but no new ride can start until then either.
- Command ordering by send stamp also narrows hypothesis [H01](../hypotheses.md) (a command queued for a previous ride delivered during a later one), since the older stamp is now ignored once any newer command has been applied. The guard that narrowing rests on, `guard isNewest` in `record(.stop)`, is covered by "the previous ride's queued stop does not retire the current ride's pending start". H01 is left untouched and still needs its own hardware validation.
- `npm run test:watch-lifecycle` is deliberately outside `ci:gate`: the GitHub gate runs on `ubuntu-latest`, which has no Swift toolchain. Adding a macOS job for it is a separate harness decision. `lint-staged` now runs it pre-commit for staged Watch-app Swift files, so the check is enforced on the machine that can actually run it.
