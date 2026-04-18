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
    static func write(_ line: String) {
        let ts = formatter.string(from: Date())
        let entry = "[\(ts)] \(line)\n"
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
}

enum WatchDisplayState: Equatable {
    case idle
    case inProgress
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
final class WorkoutManager: NSObject, ObservableObject {
    static let shared = WorkoutManager()

    // ── Published state ────────────────────────────────────────────────────────
    @Published var heartRate: Int = 0
    @Published var displayState: WatchDisplayState = .idle

    // ── Private state ──────────────────────────────────────────────────────────
    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var lastHrSendAt: TimeInterval = 0
    private var pendingSessionStatePayload: [String: Any]?

    private let hrType = HKQuantityType(.heartRate)
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
        healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [hrType]) { [weak self] success, error in
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
                self?.startWorkout(configuration: configuration)
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
            builder.dataSource = dataSource
            builder.delegate = self
            self.builder = builder

            wcLog("[WC-Watch] startWorkout: calling startActivity")
            let startDate = Date()
            session.startActivity(with: startDate)
            builder.beginCollection(withStart: startDate) { success, error in
                if let error {
                    wcLog("[WC-Watch] beginCollection FAILED: \(error.localizedDescription)")
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

    private func sendHrToPhone(_ bpm: Int) {
        let payload: [String: Any] = [
            "hr": bpm,
            "sentAtMs": Date().timeIntervalSince1970 * 1000,
        ]
        let session = WCSession.default
        guard session.activationState == .activated else {
            wcLog("[WC-Watch] sendHrToPhone dropped: WC not activated")
            return
        }

        if session.isReachable {
            wcLog("[WC-Watch] sendHrToPhone: sendMessage hr=\(bpm)")
            session.sendMessage(payload, replyHandler: nil)
        }

        if #available(watchOS 10.0, *) {
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

    private func transition(to state: WatchDisplayState) {
        DispatchQueue.main.async {
            let previous = self.displayState
            guard previous != state else { return }
            self.displayState = state
            if state == .idle {
                self.heartRate = 0
            }
            self.playHaptic(for: state, from: previous)
        }
    }

    private func playHaptic(for state: WatchDisplayState, from previous: WatchDisplayState) {
        let device = WKInterfaceDevice.current()
        switch (previous, state) {
        case (.idle, .inProgress):
            device.play(.start)
        case (.inProgress, .idle):
            device.play(.success)
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
        if toState == .running {
            transition(to: .inProgress)
            publishSessionState(WatchSessionStatePayload.started)
        } else if toState == .ended {
            transition(to: .idle)
            publishSessionState(WatchSessionStatePayload.ended)
            teardownSession()
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        wcLog("[WC-Watch] HKWorkoutSession didFailWithError: \(error.localizedDescription)")
        transition(to: .idle)
        publishSessionState(WatchSessionStatePayload.failed)
        teardownSession()
    }
}

// MARK: - WCSessionDelegate

extension WorkoutManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {
        wcLog("[WC-Watch] activationDidCompleteWith state=\(activationState.rawValue) error=\(error?.localizedDescription ?? "nil") reachable=\(session.isReachable)")
        guard activationState == .activated, error == nil, let payload = pendingSessionStatePayload else { return }
        pendingSessionStatePayload = nil

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
        switch cmd {
        case WatchCommand.start:
            let configuration = HKWorkoutConfiguration()
            configuration.activityType = .cycling
            configuration.locationType = .indoor
            requestAuthorization(starting: configuration)
        case WatchCommand.stop:
            stopWorkout()
        default:
            break
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
        guard collectedTypes.contains(hrType),
              let stats = workoutBuilder.statistics(for: hrType),
              let quantity = stats.mostRecentQuantity() else { return }
        let bpm = Int(quantity.doubleValue(for: HKUnit(from: "count/min")))
        DispatchQueue.main.async { self.heartRate = bpm }
        let now = Date().timeIntervalSinceReferenceDate
        if now - lastHrSendAt >= hrSendIntervalSeconds {
            lastHrSendAt = now
            sendHrToPhone(bpm)
        }
    }
}
