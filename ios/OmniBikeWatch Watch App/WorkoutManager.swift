import Combine
import Foundation
import HealthKit
import WatchConnectivity
import WatchKit

enum WCFileLog {
    static let url: URL = {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let u = dir.appendingPathComponent("wc.log")
        try? "=== Watch WC log started \(Date()) ===\n".write(to: u, atomically: false, encoding: .utf8)
        return u
    }()
    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss.SSS"
        return f
    }()
    // Serialize appends: wcLog is called from HealthKit and WatchConnectivity delegate
    // queues concurrently, and opening/seeking/closing a FileHandle from multiple threads
    // at once can interleave lines or throw inside FileHandle.
    private static let queue = DispatchQueue(label: "com.omnibike.wclog.watch")
    static func write(_ line: String) {
        let ts = formatter.string(from: Date())
        let entry = "[\(ts)] \(line)\n"
        queue.async {
            if let data = entry.data(using: .utf8) {
                if let handle = try? FileHandle(forWritingTo: url) {
                    handle.seekToEndOfFile()
                    handle.write(data)
                    try? handle.close()
                } else {
                    try? entry.write(to: url, atomically: false, encoding: .utf8)
                }
            }
        }
    }
}

func wcLog(_ message: String) {
    NSLog("%@", message)
    WCFileLog.write(message)
}

enum WatchSessionStatePayload {
    static let started = "started"
    static let ended = "ended"
    static let failed = "failed"
}

fileprivate enum WatchCommand {
    static let start = "start"
    static let stop = "stop"
    static let pause = "pause"
    static let resume = "resume"
}

// A ride-control action the wearer requests FROM the wrist. The Watch does not act on
// its own HKWorkoutSession here — it forwards the intent to the iPhone (the ride owner),
// which runs the same action a phone tap would and then drives the Watch session via the
// existing iPhone→Watch command path. Raw values match the iPhone module's `watchControl`.
enum WatchControlAction: String {
    case pause
    case resume
    case end
}

// Wire key for the watch→iPhone control message; matches `PayloadKey.watchControl`
// in the iPhone module.
fileprivate enum WatchControlPayload {
    static let key = "watchControl"
}

enum WatchDisplayState: Equatable {
    case idle
    case inProgress
    case paused
}

// The Watch is a pure HR source. It never authors a persisted HKWorkout:
// `finishWorkout` is never called, and on session end we call `discardWorkout`
// to drop any in-progress builder data.
//
// HKLiveWorkoutBuilder is used strictly as a sample-delivery pipe — it is the
// only path that continues delivering HR samples while the Watch display is
// dimmed during an active HKWorkoutSession. HKAnchoredObjectQuery was tried
// earlier but its updateHandler is throttled in dimmed state, which froze the
// iPhone HR widget mid-ride. The dataSource is scoped to heart-rate only so no
// energy / distance stats can be accidentally authored even if a future code
// change were to call `finishWorkout`. The iPhone remains the sole author of
// HKWorkouts via the post-session Apple Health export.
//
// Concurrency: all mutable state (session, builder, the timers, lastHrSendAt,
// latestActiveKcal, pendingSessionStatePayload, the @Published props) lives in a
// single isolation domain — the main actor. The watch target builds with
// `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`, so this type (and its delegate
// conformances) is main-actor-isolated without an explicit annotation. HealthKit and
// WatchConnectivity, however, deliver their delegate callbacks and completion handlers
// on arbitrary background queues, and in Swift 5 mode that isolation is not enforced at
// those boundaries — so every one hops onto the main actor (via `DispatchQueue.main.async`)
// before touching this state. That hop is what actually serializes access. (An explicit
// `@MainActor` here would be redundant with the build setting and only surfaces
// false-positive Sendable warnings from the HealthKit/Timer closures.)
final class WorkoutManager: NSObject, ObservableObject {
    static let shared = WorkoutManager()

    // ── Published state ────────────────────────────────────────────────────────
    @Published var heartRate: Int = 0
    @Published var displayState: WatchDisplayState = .idle
    // Whole-second elapsed time for the current session, excluding paused time (read
    // from the builder). Drives the wrist timer; reset to 0 on teardown.
    @Published var elapsedSeconds: Int = 0
    // When the most recent HR sample landed. nil before the first sample of a session;
    // lets the UI show "Connecting…" (none yet) vs "No signal" (had one, now stale).
    @Published private(set) var lastHrAt: Date?

    // ── Private state ──────────────────────────────────────────────────────────
    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var elapsedTimer: Timer?
    private var lastHrSendAt: TimeInterval = 0
    // nil until HealthKit produces its first activeEnergyBurned sample for the
    // current session. Omitting the field from the payload lets the phone fall
    // through to its power-based formula instead of pinning the dashboard to 0.
    private var latestActiveKcal: Double?
    private var pendingSessionStatePayload: [String: Any]?

    private let hrType = HKQuantityType(.heartRate)
    private let aeType = HKQuantityType(.activeEnergyBurned)
    private let hrSendIntervalSeconds: TimeInterval = 1.0

    override private init() {
        super.init()
        activateWCSession()
        recoverOrphanedSession()
    }

    // watchOS persists HKWorkoutSession state across app termination. If a prior
    // ride ended while the Watch was unreachable, the iPhone's stop command was
    // dropped and the session is still running in HealthKit — so relaunching the
    // Watch app would auto-restore it and the UI would show "Workout In Progress"
    // even though nothing is active. Recover and end any such orphan on launch.
    private func recoverOrphanedSession() {
        wcLog("[WC-Watch] recoverOrphanedSession: querying HealthKit")
        healthStore.recoverActiveWorkoutSession { [weak self] session, error in
            guard let self else { return }
            if let error {
                wcLog("[WC-Watch] recoverOrphanedSession FAILED: \(error.localizedDescription)")
                return
            }
            guard let session else {
                wcLog("[WC-Watch] recoverOrphanedSession: none found")
                return
            }
            wcLog("[WC-Watch] recoverOrphanedSession: found session state=\(session.state.rawValue) — ending")
            // HKWorkoutSessionDelegate conformance is main-actor-isolated (inferred
            // from @Published state). The recover completion is nonisolated, so
            // assign the delegate on the main actor to satisfy Swift 6 concurrency.
            // Also recover the orphan's builder and discard it — the builder would
            // otherwise hold collected samples that HealthKit counts as in-progress.
            DispatchQueue.main.async {
                session.delegate = self
                self.session = session
                let orphanBuilder = session.associatedWorkoutBuilder()
                orphanBuilder.delegate = self
                self.builder = orphanBuilder
                session.end()
            }
        }
    }

    // ── HealthKit authorization ────────────────────────────────────────────────

    func requestAuthorization(starting configuration: HKWorkoutConfiguration? = nil) {
        wcLog("[WC-Watch] requestAuthorization called starting=\(configuration != nil)")
        guard HKHealthStore.isHealthDataAvailable() else {
            wcLog("[WC-Watch] requestAuthorization: Health data not available")
            return
        }
        // HKWorkoutSession requires write authorization for HKWorkoutType even though
        // we never save an HKWorkout ourselves — it's a precondition of the session
        // start API. The companion still doesn't author a workout: there's no
        // HKLiveWorkoutBuilder, no finishWorkout, and no HKWorkout.save call.
        healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [hrType, aeType]) { [weak self] success, error in
            if let error {
                wcLog("[WC-Watch] Authorization FAILED: \(error.localizedDescription)")
                return
            }
            guard success else {
                wcLog("[WC-Watch] Authorization DENIED")
                return
            }
            wcLog("[WC-Watch] Authorization granted")
            if let configuration {
                wcLog("[WC-Watch] Authorization: proceeding to startWorkout")
                // The authorization completion is delivered off the main actor; hop on
                // before startWorkout mutates session/builder. Carry the config as its
                // Sendable enum fields (HKWorkoutConfiguration itself is non-Sendable) and
                // rebuild it on the main actor.
                let activityType = configuration.activityType
                let locationType = configuration.locationType
                DispatchQueue.main.async {
                    let config = HKWorkoutConfiguration()
                    config.activityType = activityType
                    config.locationType = locationType
                    self?.startWorkout(configuration: config)
                }
            }
        }
    }

    // ── Workout lifecycle ──────────────────────────────────────────────────────

    func startWorkout(configuration: HKWorkoutConfiguration) {
        wcLog("[WC-Watch] startWorkout called activityType=\(configuration.activityType.rawValue) locationType=\(configuration.locationType.rawValue)")
        if session != nil {
            wcLog("[WC-Watch] startWorkout: session already exists — no-op")
            return
        }

        transition(to: .inProgress)

        do {
            wcLog("[WC-Watch] startWorkout: creating HKWorkoutSession")
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            wcLog("[WC-Watch] startWorkout: HKWorkoutSession created")
            session.delegate = self
            self.session = session

            // Builder acts as the sample-delivery pipe. dataSource is scoped to HR
            // only — no energy, distance, or cycling-specific types — so the builder
            // can never accumulate totals that would end up on a persisted workout.
            // (We never call finishWorkout; this is defence-in-depth.)
            let builder = session.associatedWorkoutBuilder()
            let dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
            dataSource.enableCollection(for: hrType, predicate: nil)
            // Active energy is used as the cumulative session kcal source streamed to the
            // phone; HKLiveWorkoutBuilder computes it from HR + the wearer's Health profile
            // on `.cycling + .indoor`. We never persist it — the dataSource remains scoped
            // to sample delivery only, and `teardownSession` still calls `discardWorkout`.
            dataSource.enableCollection(for: aeType, predicate: nil)
            builder.dataSource = dataSource
            builder.delegate = self
            self.builder = builder

            wcLog("[WC-Watch] startWorkout: calling startActivity")
            let startDate = Date()
            session.startActivity(with: startDate)
            builder.beginCollection(withStart: startDate) { [weak self] success, error in
                if let error {
                    wcLog("[WC-Watch] beginCollection FAILED: \(error.localizedDescription)")
                    // Without teardown the UI stays `.inProgress`, subsequent
                    // startWorkout calls no-op on `session != nil`, and the
                    // iPhone never hears about the failure. End the HK session,
                    // clear local state, and publish `.failed` so the companion
                    // can recover. The `.ended` delegate will later run a
                    // second (idempotent) teardown.
                    DispatchQueue.main.async {
                        guard let self else { return }
                        self.session?.end()
                        self.teardownSession()
                        self.transition(to: .idle)
                        self.publishSessionState(WatchSessionStatePayload.failed)
                    }
                    return
                }
                wcLog("[WC-Watch] beginCollection success=\(success)")
            }

            // Per WWDC23 session 10023: mirror the primary session back to the
            // iPhone companion so its `workoutSessionMirroringStartHandler` fires.
            // The iPhone already initiated the whole flow via `startWatchApp`, so
            // this closes the canonical loop.
            wcLog("[WC-Watch] startWorkout: calling startMirroringToCompanionDevice")
            session.startMirroringToCompanionDevice { success, error in
                if let error {
                    wcLog("[WC-Watch] startMirroringToCompanionDevice FAILED: \(error.localizedDescription)")
                    return
                }
                wcLog("[WC-Watch] startMirroringToCompanionDevice success=\(success)")
            }
        } catch {
            wcLog("[WC-Watch] startWorkout THREW: \(error.localizedDescription)")
            transition(to: .idle)
            publishSessionState(WatchSessionStatePayload.failed)
        }
    }

    func stopWorkout() {
        wcLog("[WC-Watch] stopWorkout called")
        guard let session else {
            wcLog("[WC-Watch] stopWorkout: no active session")
            return
        }
        session.end()
    }

    // The iPhone owns the session lifecycle and forwards pause/resume as commands;
    // the Watch owns the HKWorkoutSession, so only it can pause/resume it. Pausing
    // stops the system workout timer and suspends HKLiveWorkoutBuilder collection —
    // HR is no longer measured or streamed until resume.
    func pauseWorkout() {
        wcLog("[WC-Watch] pauseWorkout called")
        guard let session, session.state == .running else {
            wcLog("[WC-Watch] pauseWorkout: no running session — ignoring")
            return
        }
        session.pause()
    }

    func resumeWorkout() {
        wcLog("[WC-Watch] resumeWorkout called")
        guard let session, session.state == .paused else {
            wcLog("[WC-Watch] resumeWorkout: no paused session — ignoring")
            return
        }
        session.resume()
    }

    // `discardWorkout` is the explicit "drop all collected data, do not persist"
    // operation on HKLiveWorkoutBuilder — the opposite of `finishWorkout`. This is
    // what guarantees the Watch never authors a ghost HKWorkout. Called on
    // session end and on orphan recovery.
    private func teardownSession() {
        if let builder {
            builder.discardWorkout()
            wcLog("[WC-Watch] discarded in-progress workout builder")
        }
        builder = nil
        session = nil
        lastHrSendAt = 0
        // Clear before the next session's first delegate callback so a stale
        // cumulative value is never piggy-backed onto the first HR payload.
        latestActiveKcal = nil
        stopElapsedTimer(reset: true)
        lastHrAt = nil
    }

    // ── Elapsed time ─────────────────────────────────────────────────────────────
    // Ticks once a second on the main run loop, publishing the builder's elapsed time
    // (which already excludes paused intervals). The view re-renders from this and also
    // recomputes HR freshness on each tick.
    private func startElapsedTimer() {
        DispatchQueue.main.async {
            self.elapsedTimer?.invalidate()
            let timer = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in
                guard let self else { return }
                let interval = self.builder?.elapsedTime ?? 0
                self.elapsedSeconds = Int(interval)
            }
            RunLoop.main.add(timer, forMode: .common)
            self.elapsedTimer = timer
        }
    }

    private func stopElapsedTimer(reset: Bool) {
        DispatchQueue.main.async {
            self.elapsedTimer?.invalidate()
            self.elapsedTimer = nil
            if reset { self.elapsedSeconds = 0 }
        }
    }

    // ── WatchConnectivity ──────────────────────────────────────────────────────

    private func activateWCSession() {
        wcLog("[WC-Watch] activateWCSession called")
        guard WCSession.isSupported() else {
            wcLog("[WC-Watch] WCSession not supported")
            return
        }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // Forwards the Watch app's foreground/background lifecycle to the iPhone for
    // observability — an event-driven "is the Watch app running" signal that, unlike
    // `isReachable`, does not flap when the screen merely dims. Best-effort live send;
    // the transition is captured in the Watch's wc.log regardless of reachability.
    func reportAppState(_ state: String) {
        wcLog("[WC-Watch] appState -> \(state)")
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(["watchAppState": state, "sentAtMs": Date().timeIntervalSince1970 * 1000], replyHandler: nil)
    }

    // Forwards a wrist-initiated ride control (Pause / Resume / End) to the iPhone, which
    // owns the ride. Live via sendMessage when reachable; otherwise queued FIFO via
    // transferUserInfo so it still arrives when the iPhone next wakes — the same delivery
    // contract the iPhone uses for its own commands. The Watch does NOT touch its own
    // HKWorkoutSession here; the iPhone's resulting pause/stop command does that.
    func requestControl(_ action: WatchControlAction) {
        wcLog("[WC-Watch] requestControl action=\(action.rawValue)")
        let session = WCSession.default
        guard session.activationState == .activated else {
            wcLog("[WC-Watch] requestControl dropped: WC not activated")
            return
        }
        let payload: [String: Any] = [
            WatchControlPayload.key: action.rawValue,
            "sentAtMs": Date().timeIntervalSince1970 * 1000,
        ]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil)
        } else {
            wcLog("[WC-Watch] requestControl: unreachable — queuing via transferUserInfo")
            session.transferUserInfo(payload)
        }
        // Immediate tactile confirmation that the tap registered — the iPhone round-trip
        // (which actually pauses/ends the session) lands a beat later with its own haptic.
        WKInterfaceDevice.current().play(.click)
    }

    private func sendHrToPhone(_ bpm: Int) {
        var payload: [String: Any] = [
            "hr": bpm,
            "sentAtMs": Date().timeIntervalSince1970 * 1000,
        ]
        if let kcal = latestActiveKcal {
            payload["activeKcal"] = kcal
        }
        let session = WCSession.default
        guard session.activationState == .activated else {
            wcLog("[WC-Watch] sendHrToPhone dropped: WC not activated")
            return
        }

        if session.isReachable {
            wcLog("[WC-Watch] sendHrToPhone: sendMessage hr=\(bpm)")
            session.sendMessage(payload, replyHandler: nil)
        }

        // T5 mirrored-session leg: the only channel that keeps delivering while the Watch
        // screen is dimmed (app still frontmost during an active session).
        if let workoutSession = self.session {
            do {
                let data = try JSONSerialization.data(withJSONObject: payload)
                Task {
                    do {
                        try await workoutSession.sendToRemoteWorkoutSession(data: data)
                    } catch {
                        wcLog("[WC-Watch] sendHrToPhone: sendToRemoteWorkoutSession FAILED: \(error.localizedDescription)")
                    }
                }
            } catch {
                wcLog("[WC-Watch] sendHrToPhone: payload encode FAILED: \(error.localizedDescription)")
            }
        } else {
            wcLog("[WC-Watch] sendHrToPhone: missing workout session for mirrored payload")
        }

        do {
            try session.updateApplicationContext(payload)
        } catch {
            wcLog("[WC-Watch] sendHrToPhone: updateApplicationContext FAILED: \(error.localizedDescription)")
        }
    }

    private func publishSessionState(_ state: String) {
        wcLog("[WC-Watch] publishSessionState state=\(state)")
        let payload: [String: Any] = [
            "sessionState": state,
            "sentAtMs": Date().timeIntervalSince1970 * 1000,
        ]
        let session = WCSession.default
        wcLog("[WC-Watch] publishSessionState WC state=\(session.activationState.rawValue) reachable=\(session.isReachable)")

        if session.activationState == .activated, session.isReachable {
            wcLog("[WC-Watch] publishSessionState: sendMessage state=\(state)")
            session.sendMessage(payload, replyHandler: nil)
        }

        guard session.activationState == .activated else {
            wcLog("[WC-Watch] publishSessionState: WC not activated, queueing")
            pendingSessionStatePayload = payload
            return
        }

        do {
            try session.updateApplicationContext(payload)
            wcLog("[WC-Watch] publishSessionState: updateApplicationContext ok state=\(state)")
        } catch {
            wcLog("[WC-Watch] publishSessionState: updateApplicationContext FAILED: \(error.localizedDescription)")
        }
    }

    // ── Display state + haptics ────────────────────────────────────────────────

    // Always defers to a later main turn (even when called from the main actor) so the UI
    // state / haptic / timer settle after the caller's synchronous work — e.g. callers may
    // run `transition(to:)` then publishSessionState/teardownSession in the same turn, and
    // `displayState` is intentionally NOT observed to be set synchronously on return.
    private func transition(to state: WatchDisplayState) {
        DispatchQueue.main.async {
            let previous = self.displayState
            guard previous != state else { return }
            self.displayState = state
            switch state {
            case .inProgress:
                self.startElapsedTimer()
            case .idle:
                self.heartRate = 0
                self.stopElapsedTimer(reset: true)
            case .paused:
                break // keep the timer; the builder freezes elapsedTime while paused
            }
            self.playHaptic(for: state, from: previous)
        }
    }

    private func playHaptic(for state: WatchDisplayState, from previous: WatchDisplayState) {
        let device = WKInterfaceDevice.current()
        switch (previous, state) {
        case (.idle, .inProgress), (.paused, .inProgress):
            device.play(.start)
        case (.inProgress, .idle), (.paused, .idle):
            device.play(.success)
        case (.inProgress, .paused):
            device.play(.stop)
        default:
            break
        }
    }
}

// MARK: - HKWorkoutSessionDelegate

extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
                        from fromState: HKWorkoutSessionState, date: Date) {
        wcLog("[WC-Watch] HKWorkoutSession didChangeTo \(toState.rawValue) from \(fromState.rawValue)")
        // HealthKit delivers this off the main actor; hop on before publishSessionState
        // (pendingSessionStatePayload) and teardownSession (session/builder/…) run.
        DispatchQueue.main.async {
            if toState == .running {
                self.transition(to: .inProgress)
                self.publishSessionState(WatchSessionStatePayload.started)
            } else if toState == .paused {
                // iPhone initiated the pause (it sent the command), so we don't echo a
                // session-state event back — just reflect it on the Watch. The system
                // workout timer and HR collection are paused by HealthKit.
                self.transition(to: .paused)
            } else if toState == .ended {
                self.transition(to: .idle)
                self.publishSessionState(WatchSessionStatePayload.ended)
                self.teardownSession()
            }
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        wcLog("[WC-Watch] HKWorkoutSession didFailWithError: \(error.localizedDescription)")
        DispatchQueue.main.async {
            self.transition(to: .idle)
            self.publishSessionState(WatchSessionStatePayload.failed)
            self.teardownSession()
        }
    }
}

// MARK: - WCSessionDelegate

extension WorkoutManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {
        wcLog("[WC-Watch] activationDidCompleteWith state=\(activationState.rawValue) error=\(error?.localizedDescription ?? "nil") reachable=\(session.isReachable)")
        let activationOK = activationState == .activated && error == nil
        // Delivered off the main actor; hop on before reading/clearing
        // pendingSessionStatePayload.
        DispatchQueue.main.async {
            guard activationOK, let payload = self.pendingSessionStatePayload else { return }
            self.pendingSessionStatePayload = nil

            let session = WCSession.default
            wcLog("[WC-Watch] flushing pending session state payload")
            if session.isReachable {
                session.sendMessage(payload, replyHandler: nil)
            }

            do {
                try session.updateApplicationContext(payload)
            } catch {
                wcLog("[WC-Watch] flush pending FAILED: \(error.localizedDescription)")
            }
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        wcLog("[WC-Watch] didReceiveMessage keys=\(Array(message.keys))")
        handleCommand(in: message, source: "message")
    }

    // iPhone queues `stop` via transferUserInfo when the Watch is unreachable at
    // end-of-ride, so an orphaned HKWorkoutSession is ended the next time the
    // Watch wakes. Delivered in the background without foregrounding the app.
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        wcLog("[WC-Watch] didReceiveUserInfo keys=\(Array(userInfo.keys))")
        handleCommand(in: userInfo, source: "userInfo")
    }

    private func handleCommand(in payload: [String: Any], source: String) {
        guard let cmd = payload["cmd"] as? String else { return }
        wcLog("[WC-Watch] handleCommand cmd=\(cmd) source=\(source)")
        // WCSession delivers messages/user-info on a background queue; hop onto the
        // main actor before driving the session (start/stop/pause/resume touch
        // session + builder).
        DispatchQueue.main.async {
            switch cmd {
            case WatchCommand.start:
                let configuration = HKWorkoutConfiguration()
                configuration.activityType = .cycling
                configuration.locationType = .indoor
                self.requestAuthorization(starting: configuration)
            case WatchCommand.stop:
                self.stopWorkout()
            case WatchCommand.pause:
                self.pauseWorkout()
            case WatchCommand.resume:
                self.resumeWorkout()
            default:
                break
            }
        }
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

// The builder is used purely as a sample-delivery pipe: during an active
// HKWorkoutSession its delegate continues firing while the Watch display is
// dimmed, which HKAnchoredObjectQuery's updateHandler does not. We read the
// latest HR from `statistics(for:)` and forward it to the iPhone. We never
// call `finishWorkout` — `teardownSession` calls `discardWorkout` instead.
extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                        didCollectDataOf collectedTypes: Set<HKSampleType>) {
        // Read the statistics on the builder's own delivery queue, capture plain
        // values, then hop onto the main actor to mutate state (latestActiveKcal,
        // lastHrSendAt) and send. Active energy arrives as its own collection event;
        // record the cumulative session total so the next HR tick piggy-backs it onto
        // the payload. HR stays the single throttle source to preserve 1 Hz cadence.
        var kcal: Double?
        if collectedTypes.contains(aeType),
           let energyStats = workoutBuilder.statistics(for: aeType),
           let energyQuantity = energyStats.sumQuantity() {
            kcal = energyQuantity.doubleValue(for: .kilocalorie())
        }

        guard collectedTypes.contains(hrType),
              let stats = workoutBuilder.statistics(for: hrType),
              let quantity = stats.mostRecentQuantity() else {
            // Energy can land without HR; still record the latest cumulative value.
            if let kcal {
                DispatchQueue.main.async { self.latestActiveKcal = kcal }
            }
            return
        }
        let bpm = Int(quantity.doubleValue(for: HKUnit(from: "count/min")))
        DispatchQueue.main.async {
            if let kcal { self.latestActiveKcal = kcal }
            self.heartRate = bpm
            self.lastHrAt = Date()
            let now = Date().timeIntervalSinceReferenceDate
            if now - self.lastHrSendAt >= self.hrSendIntervalSeconds {
                self.lastHrSendAt = now
                self.sendHrToPhone(bpm)
            }
        }
    }
}
