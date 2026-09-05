// Desired-lifecycle model for the Watch companion's HKWorkoutSession.
//
// The iPhone owns the ride; the Watch owns the HKWorkoutSession, so every ride control
// reaches the Watch as an asynchronous command and every state change it triggers settles
// asynchronously too (a HealthKit transition callback, or a Health authorization prompt).
// Guarding that work with "what is the session doing right now" lets whichever callback
// happens to land last decide the outcome, and the newer intent is lost: a Resume issued
// while a pause was still settling used to be swallowed by the in-flight interlock and
// never re-applied, and a Stop that arrived while authorization was still pending used to
// be dropped for want of a session, after which the authorization opened a workout for a
// ride that had already ended.
//
// This type holds the intent instead of inferring it: the newest intent the iPhone has
// expressed, the generation of the start it belongs to, and the send stamp that orders
// commands which the two WatchConnectivity transports can deliver out of order.
// `WorkoutManager` is the only thing that turns a decision here into a HealthKit call.
//
// Deliberately free of HealthKit, WatchConnectivity and WatchKit imports so the ordering
// rules can be exercised on their own (see `native-tests/WatchLifecycleTests.swift`).

/// The lifecycle state the iPhone has most recently asked the Watch for.
enum WatchLifecycleIntent {
    case idle
    case running
    case paused
}

/// A ride control as it arrives from the iPhone. Raw values match the `cmd` payload the
/// iPhone module sends.
enum WatchLifecycleCommand: String {
    case start
    case stop
    case pause
    case resume

    var intent: WatchLifecycleIntent {
        switch self {
        case .start, .resume:
            return .running
        case .pause:
            return .paused
        case .stop:
            return .idle
        }
    }
}

/// The Watch's own HKWorkoutSession, reduced to what a lifecycle decision needs.
/// `none` covers both "never created" and "torn down"; `starting` covers the window
/// between creating the session and HealthKit reporting it running, where the only
/// meaningful correction is to abandon the ride.
enum WatchWorkoutState {
    case none
    case starting
    case running
    case paused
    case ended
}

/// What the manager should do to the session to match the current intent.
enum WatchLifecycleAction {
    case none
    case pause
    case resume
    case end
}

/// Outcome of recording one iPhone command.
struct WatchLifecycleDecision {
    /// True when the command was the newest intent seen and moved the desired state.
    let intentApplied: Bool
    /// Non-nil when the manager should run the authorization and start sequence. The
    /// value is the generation that sequence must still match when it completes.
    let startGeneration: Int?
}

struct WatchLifecycleModel {
    /// The newest lifecycle state the iPhone asked for. Every settled transition is
    /// reconciled against this rather than against the callback that just landed.
    private(set) var desired: WatchLifecycleIntent = .idle

    /// Send stamp of the newest command whose intent was applied. The iPhone reaches the
    /// Watch over two transports: `sendMessage` while reachable, `transferUserInfo`
    /// (queued, delivered whenever the Watch next wakes) while not. A pause queued with
    /// the wrist down can therefore land after a resume sent live, so commands are ordered
    /// by the iPhone's own send stamp instead of by arrival. Monotonic wall clock, and
    /// deliberately never reset between rides, exactly like the iPhone's sample de-dup
    /// high-water mark.
    private(set) var lastCommandSentAtMs: Double?

    /// Bumped by every start request and by every applied stop. An authorization or start
    /// sequence carries the value it was issued under and gives up once it is no longer
    /// current, so a completion that lands late can never resurrect a cancelled start.
    private(set) var startGeneration = 0

    /// Records one iPhone command.
    ///
    /// A command older than the newest one already applied never moves the desired state
    /// backwards. `start` is the exception on the action side: it is not only an intent but
    /// the only trigger that creates a session, so an overtaken start still opens its
    /// session (unless a stop has since made the desired state `idle`) and the session then
    /// reconciles to the newer intent, rather than leaving the Watch out of the ride.
    mutating func record(_ command: WatchLifecycleCommand, sentAtMs: Double?) -> WatchLifecycleDecision {
        let isNewest = isNewer(sentAtMs)
        if isNewest {
            if let sentAtMs {
                lastCommandSentAtMs = sentAtMs
            }
            desired = command.intent
        }

        switch command {
        case .start:
            guard desired != .idle else {
                return WatchLifecycleDecision(intentApplied: isNewest, startGeneration: nil)
            }
            startGeneration += 1
            return WatchLifecycleDecision(intentApplied: isNewest, startGeneration: startGeneration)
        case .stop:
            guard isNewest else {
                return WatchLifecycleDecision(intentApplied: false, startGeneration: nil)
            }
            // Invalidate any authorization or start still in flight. This is the half the
            // old `guard let session else { return }` could not do.
            startGeneration += 1
            return WatchLifecycleDecision(intentApplied: true, startGeneration: nil)
        case .pause, .resume:
            return WatchLifecycleDecision(intentApplied: isNewest, startGeneration: nil)
        }
    }

    /// Whether a start sequence issued under `generation` may still open a session.
    func mayStart(generation: Int) -> Bool {
        return generation == startGeneration && desired != .idle
    }

    /// The single correction that brings the session in line with the desired state.
    ///
    /// Returns `.none` while a transition is in flight: the duplicate-transition interlock
    /// is what keeps a redundant `pause()` from making HealthKit fail the whole session, so
    /// it stays. The intent is not lost by waiting, because the settling callback asks
    /// again. Never returns an action that would create a session: only a `start` does that,
    /// so a stray pause or resume can never spin one up.
    func action(for state: WatchWorkoutState, transitionInFlight: Bool) -> WatchLifecycleAction {
        guard !transitionInFlight else {
            return .none
        }
        switch state {
        case .none, .ended:
            return .none
        case .starting:
            // Nothing to pause or resume yet. Ending is valid and must not wait, otherwise a
            // ride cancelled during start-up leaks a workout.
            return desired == .idle ? .end : .none
        case .running:
            switch desired {
            case .idle:
                return .end
            case .paused:
                return .pause
            case .running:
                return .none
            }
        case .paused:
            switch desired {
            case .idle:
                return .end
            case .running:
                return .resume
            case .paused:
                return .none
            }
        }
    }

    private func isNewer(_ sentAtMs: Double?) -> Bool {
        guard let sentAtMs, let last = lastCommandSentAtMs else {
            // No stamp on either side means no ordering information: apply as-is.
            return true
        }
        return sentAtMs > last
    }
}
