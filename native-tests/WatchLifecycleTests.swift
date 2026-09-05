// Host-run checks for the Watch companion's pure lifecycle model.
//
// `WatchLifecycle.swift` deliberately has no HealthKit / WatchConnectivity / WatchKit
// imports, so it compiles and runs on the Mac. That is what makes the ordering rules
// behind A09 executable: the failure modes are pure orderings of commands and settled
// transitions, and none of them need a paired Watch to demonstrate.
//
// Run with `npm run test:watch-lifecycle`. Not part of `ci:gate`: the GitHub gate runs
// on Linux with no Swift toolchain.

import Foundation

@main
struct WatchLifecycleTests {
    private static var failures: [String] = []

    static func main() {
        pauseThenResumeBeforeThePausedCallback()
        resumeThenPauseBeforeTheRunningCallback()
        resumeIsNotIssuedWhileTheTransitionIsStillInFlight()
        stopWhileAuthorizationIsPendingCancelsTheStart()
        stopWithNoSessionStillCancelsAPendingStart()
        stopRetiresThePendingStartNotJustTheDesiredState()
        duplicateStartLetsTheLaterOneWin()
        aGenuinelyLaterStartAfterStopIsHonoured()
        aStaleQueuedPauseNeverOverridesANewerResume()
        aDuplicateDeliveryOfTheSameCommandIsNotNewer()
        aStaleStartStillCreatesTheSessionButKeepsTheNewerIntent()
        aStaleStartDeliveredAfterAStopOpensNoSession()
        aStaleStopDoesNotRetireTheCurrentRidesPendingStart()
        stopSupersedesAnInFlightPause()
        endingIsNeverDeferredByTheInterlock()
        anUnstampedCommandAppliesWithoutMovingTheOrderingMark()
        withoutASessionThereIsNothingToReconcile()
        aRideCancelledDuringStartUpIsEndedNotLeaked()

        if failures.isEmpty {
            print("WatchLifecycle: all checks passed")
            exit(0)
        }
        for failure in failures {
            print("FAIL \(failure)")
        }
        print("WatchLifecycle: \(failures.count) check(s) failed")
        exit(1)
    }

    // MARK: - Checks

    /// Ticket sequence 1. Pause starts a HealthKit transition; Resume arrives before the
    /// paused callback. The interlock must still swallow the immediate second transition,
    /// but the newer intent must survive it and be applied once the pause settles.
    private static func pauseThenResumeBeforeThePausedCallback() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        expect(model.action(for: .running, transitionInFlight: false), .none, "settled running needs no action")

        _ = model.record(.pause, sentAtMs: 200)
        expect(model.action(for: .running, transitionInFlight: false), .pause, "pause intent pauses a running session")

        _ = model.record(.resume, sentAtMs: 300)
        expect(model.action(for: .paused, transitionInFlight: false), .resume,
               "resume issued mid-transition is applied when the paused callback lands")
    }

    /// Ticket sequence 1, the other way round. Resume starts a HealthKit transition; Pause
    /// arrives before the running callback. The symmetry is by construction, but the ticket
    /// asks for both directions, so both are asserted.
    private static func resumeThenPauseBeforeTheRunningCallback() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        _ = model.record(.pause, sentAtMs: 200)
        expect(model.action(for: .paused, transitionInFlight: false), .none, "the settled pause needs no action")

        _ = model.record(.resume, sentAtMs: 300)
        expect(model.action(for: .paused, transitionInFlight: false), .resume, "resume intent resumes a paused session")
        // The resume is now in flight: `session.state` still reads paused, and re-issuing it
        // is the double transition that fails the whole session.
        expect(model.action(for: .paused, transitionInFlight: true), .none,
               "no second transition while the resume is in flight")

        _ = model.record(.pause, sentAtMs: 400)
        expect(model.action(for: .running, transitionInFlight: false), .pause,
               "pause issued mid-resume is applied when the running callback lands")
    }

    /// The duplicate-transition interlock is what keeps a redundant pause() from tearing
    /// the HKWorkoutSession down, so it must survive the fix.
    private static func resumeIsNotIssuedWhileTheTransitionIsStillInFlight() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        _ = model.record(.pause, sentAtMs: 200)
        _ = model.record(.resume, sentAtMs: 300)
        // `session.state` has already flipped to paused, but the callback has not landed:
        // issuing the resume here is the double transition that fails the whole session.
        expect(model.action(for: .paused, transitionInFlight: true), .none,
               "no second transition while one is in flight")
    }

    /// Ticket sequence 2. Start awaits authorization, Stop arrives while the session is
    /// still nil, authorization then succeeds: the completion must not start a workout.
    private static func stopWhileAuthorizationIsPendingCancelsTheStart() {
        var model = WatchLifecycleModel()
        guard let generation = model.record(.start, sentAtMs: 100).startGeneration else {
            fail("start must hand back a generation to authorize under")
            return
        }
        _ = model.record(.stop, sentAtMs: 200)
        expect(model.desired, .idle, "stop moves the desired state to idle")
        expect(model.mayStart(generation: generation), false,
               "a late authorization for a cancelled start may not open a workout")
    }

    /// The old `stopWorkout` returned early when no session existed, which is exactly the
    /// window a pending authorization lives in.
    private static func stopWithNoSessionStillCancelsAPendingStart() {
        var model = WatchLifecycleModel()
        let generation = model.record(.start, sentAtMs: 100).startGeneration ?? -1
        let stop = model.record(.stop, sentAtMs: 200)
        expect(stop.intentApplied, true, "stop applies even with no session")
        expect(stop.startGeneration == nil, true, "a stop never asks for a start sequence of its own")
        expect(model.mayStart(generation: generation), false, "the pending start is invalidated")
    }

    /// A stop must retire the pending start itself, not merely make the desired state idle.
    /// Otherwise a later intent that makes the desired state running again would let the
    /// authorization from the cancelled start through.
    private static func stopRetiresThePendingStartNotJustTheDesiredState() {
        var model = WatchLifecycleModel()
        let generation = model.record(.start, sentAtMs: 100).startGeneration ?? -1
        _ = model.record(.stop, sentAtMs: 200)
        _ = model.record(.resume, sentAtMs: 300)
        expect(model.desired, .running, "a later resume moves the desired state again")
        expect(model.mayStart(generation: generation), false,
               "the authorization from the cancelled start stays retired")
    }

    private static func duplicateStartLetsTheLaterOneWin() {
        var model = WatchLifecycleModel()
        let first = model.record(.start, sentAtMs: 100).startGeneration ?? -1
        let second = model.record(.start, sentAtMs: 200).startGeneration ?? -2
        expect(first != second, true, "a second start supersedes the first")
        expect(model.mayStart(generation: first), false, "the superseded start is abandoned")
        expect(model.mayStart(generation: second), true, "the newest start proceeds")
    }

    private static func aGenuinelyLaterStartAfterStopIsHonoured() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        _ = model.record(.stop, sentAtMs: 200)
        guard let generation = model.record(.start, sentAtMs: 300).startGeneration else {
            fail("a start after a stop must be able to run")
            return
        }
        expect(model.desired, .running, "the newer start owns the desired state")
        expect(model.mayStart(generation: generation), true, "the next ride starts normally")
    }

    /// Real transport, not callbacks: the iPhone sends live via sendMessage while reachable
    /// and queues via transferUserInfo while not, so a pause queued with the wrist down can
    /// be delivered after a resume sent live. Order by the phone's send stamp, not arrival.
    private static func aStaleQueuedPauseNeverOverridesANewerResume() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        _ = model.record(.resume, sentAtMs: 300)
        let latePause = model.record(.pause, sentAtMs: 200)
        expect(latePause.intentApplied, false, "a command older than the newest applied is ignored")
        expect(model.desired, .running, "the newer resume still owns the desired state")
        expect(model.action(for: .running, transitionInFlight: false), .none, "the ride keeps running")
    }

    /// The same command can reach the Watch twice, carrying the same stamp: a live
    /// `sendMessage` plus a queued `transferUserInfo` retry, or a coalesced applicationContext.
    /// Ordering is strict, so a repeat delivery is never "newer" and must change nothing:
    /// for a stop in particular, it must not retire a start generation a second time.
    private static func aDuplicateDeliveryOfTheSameCommandIsNotNewer() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        expect(model.record(.pause, sentAtMs: 200).intentApplied, true, "the first delivery applies")
        expect(model.record(.pause, sentAtMs: 200).intentApplied, false,
               "a repeat delivery carrying the same stamp is not newer")

        var stopping = WatchLifecycleModel()
        let generation = stopping.record(.start, sentAtMs: 100).startGeneration ?? -1
        _ = stopping.record(.stop, sentAtMs: 200)
        let generationAfterTheStop = stopping.startGeneration
        expect(stopping.record(.stop, sentAtMs: 200).intentApplied, false, "a repeat stop is not newer either")
        expect(stopping.startGeneration, generationAfterTheStop,
               "a repeat stop does not retire a start generation twice")
        expect(stopping.mayStart(generation: generation), false, "the cancelled start stays retired")
    }

    /// A start is both an intent and the only trigger that creates a session, so an
    /// overtaken start still opens the session and then reconciles to the newer intent
    /// rather than leaving the Watch out of the ride entirely.
    private static func aStaleStartStillCreatesTheSessionButKeepsTheNewerIntent() {
        var model = WatchLifecycleModel()
        _ = model.record(.pause, sentAtMs: 200)
        let lateStart = model.record(.start, sentAtMs: 100)
        expect(lateStart.intentApplied, false, "a stale start does not move the desired state back")
        expect(lateStart.startGeneration != nil, true, "a stale start still opens its session")
        expect(model.desired, .paused, "the newer pause still owns the desired state")
        expect(model.action(for: .running, transitionInFlight: false), .pause,
               "the session reconciles to the newer intent once it settles")
    }

    /// A09's own defect class, on the start side: a `start` queued while the Watch was
    /// unreachable, delivered after the stop that ended that ride. It is older than the stop,
    /// so the desired state stays idle, and it must hand back no generation at all, because a
    /// generation is what sends `WorkoutManager` off to authorize and open an HKWorkoutSession
    /// for a ride the user has already finished.
    private static func aStaleStartDeliveredAfterAStopOpensNoSession() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        _ = model.record(.stop, sentAtMs: 300)
        let queuedStart = model.record(.start, sentAtMs: 200)
        expect(queuedStart.intentApplied, false, "a start older than the stop does not move the desired state")
        expect(queuedStart.startGeneration == nil, true,
               "a start older than the stop that ended the ride opens no session")
        expect(model.desired, .idle, "the ride stays ended")
    }

    /// The mirror image, on the stop side, and the guard hypothesis H01's narrowing rests on:
    /// ride N-1's stop was queued with the wrist down and lands during ride N, whose start is
    /// still waiting on the Health prompt. It is older than ride N's start, so it must not
    /// retire that pending start; doing so would leave the Watch out of ride N entirely, with
    /// no phone-side retry.
    private static func aStaleStopDoesNotRetireTheCurrentRidesPendingStart() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        guard let generation = model.record(.start, sentAtMs: 300).startGeneration else {
            fail("the current ride's start must hand back a generation to authorize under")
            return
        }
        let staleStop = model.record(.stop, sentAtMs: 200)
        expect(staleStop.intentApplied, false, "a stop older than the newest applied command is ignored")
        expect(model.desired, .running, "the current ride keeps running")
        expect(model.mayStart(generation: generation), true,
               "the previous ride's queued stop does not retire the current ride's pending start")
    }

    private static func stopSupersedesAnInFlightPause() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        _ = model.record(.pause, sentAtMs: 200)
        _ = model.record(.stop, sentAtMs: 300)
        expect(model.action(for: .paused, transitionInFlight: false), .end,
               "the ride ends as soon as the pause settles")
    }

    /// The interlock exists to stop a redundant pause() from failing the whole session. It
    /// must not gate the end: `end()` is valid from every state the session can be in here,
    /// and a pause or resume whose callback never lands would otherwise leave a live
    /// HKWorkoutSession on the wrist that no command from either device could stop.
    private static func endingIsNeverDeferredByTheInterlock() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        _ = model.record(.pause, sentAtMs: 200)
        _ = model.record(.stop, sentAtMs: 300)
        expect(model.action(for: .running, transitionInFlight: true), .end,
               "a stop ends a running session even while a pause is still settling")
        expect(model.action(for: .paused, transitionInFlight: true), .end,
               "a stop ends a paused session even while a resume is still settling")
        expect(model.action(for: .starting, transitionInFlight: true), .end,
               "a stop ends a session still starting even while a transition is in flight")
    }

    /// The HealthKit-initiated wake (`WKApplicationDelegate.handle`) carries no payload of
    /// ours, so it has no stamp. It must still start the ride, and must not poison the
    /// ordering of the stamped commands around it.
    private static func anUnstampedCommandAppliesWithoutMovingTheOrderingMark() {
        var model = WatchLifecycleModel()
        _ = model.record(.pause, sentAtMs: 200)
        let wake = model.record(.start, sentAtMs: nil)
        expect(wake.intentApplied, true, "an unstamped command cannot be ordered, so it applies")
        expect(model.desired, .running, "the wake starts the ride")
        expect(model.lastCommandSentAtMs, 200, "the ordering mark is untouched by an unstamped command")
        expect(model.record(.pause, sentAtMs: 250).intentApplied, true, "later stamped commands still apply")
    }

    /// A session exists but HealthKit has not reported it running yet. There is nothing to
    /// pause or resume in that window, but a stop must still end it rather than leak it.
    private static func aRideCancelledDuringStartUpIsEndedNotLeaked() {
        var model = WatchLifecycleModel()
        _ = model.record(.start, sentAtMs: 100)
        expect(model.action(for: .starting, transitionInFlight: false), .none, "nothing to correct while starting")
        _ = model.record(.pause, sentAtMs: 200)
        expect(model.action(for: .starting, transitionInFlight: false), .none, "a pause waits for the running state")
        _ = model.record(.stop, sentAtMs: 300)
        expect(model.action(for: .starting, transitionInFlight: false), .end, "a stop ends a session still starting")
    }

    private static func withoutASessionThereIsNothingToReconcile() {
        var model = WatchLifecycleModel()
        _ = model.record(.pause, sentAtMs: 100)
        expect(model.action(for: .none, transitionInFlight: false), .none, "no session, no action")
        expect(model.action(for: .ended, transitionInFlight: false), .none, "an ended session is not revived")
        // The other half: now that ending is exempt from the interlock, a session already
        // ended (by HealthKit, or by the end this stop's predecessor issued) must not be
        // handed another end().
        _ = model.record(.stop, sentAtMs: 200)
        expect(model.action(for: .ended, transitionInFlight: false), .none, "an ended session is not ended again")
        expect(model.action(for: .none, transitionInFlight: false), .none, "a stop with no session has nothing to end")
    }

    // MARK: - Tiny assertion helpers

    private static func expect<T: Equatable>(_ actual: T, _ expected: T, _ name: String) {
        if actual != expected {
            fail("\(name): expected \(expected), got \(actual)")
        }
    }

    private static func fail(_ message: String) {
        failures.append(message)
    }
}
