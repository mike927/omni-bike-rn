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
    case starting
    case active
    case ending
    case ended
    case failed
}

final class WorkoutManager: NSObject, ObservableObject {
    static let shared = WorkoutManager()

    // ── Published state ────────────────────────────────────────────────────────
    @Published var heartRate: Int = 0
    @Published var isStreaming: Bool = false
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
            session.delegate = self
            self.session = session
            self.builder = session.associatedWorkoutBuilder()
            self.builder?.delegate = self
            self.transition(to: .ending)
            session.end()
        }
    }

    // ── HealthKit authorization ────────────────────────────────────────────────

    func requestAuthorization(starting configuration: HKWorkoutConfiguration? = nil) {
        wcLog("[WC-Watch] requestAuthorization called starting=\(configuration != nil)")
        guard HKHealthStore.isHealthDataAvailable() else {
            wcLog("[WC-Watch] requestAuthorization: Health data not available")
            return
        }
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

        transition(to: .starting)

        do {
            wcLog("[WC-Watch] startWorkout: creating HKWorkoutSession")
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            wcLog("[WC-Watch] startWorkout: HKWorkoutSession created")
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
            session.delegate = self
            builder.delegate = self
            self.session = session
            self.builder = builder

            wcLog("[WC-Watch] startWorkout: calling startActivity")
            session.startActivity(with: Date())
            wcLog("[WC-Watch] startWorkout: calling beginCollection")
            builder.beginCollection(withStart: Date()) { [weak self] _, error in
                if let error {
                    wcLog("[WC-Watch] beginCollection FAILED: \(error.localizedDescription)")
                    self?.transition(to: .failed)
                    self?.publishSessionState(WatchSessionStatePayload.failed)
                    return
                }
                wcLog("[WC-Watch] beginCollection succeeded")
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
            transition(to: .failed)
            publishSessionState(WatchSessionStatePayload.failed)
        }
    }

    func stopWorkout() {
        wcLog("[WC-Watch] stopWorkout called")
        guard let session else {
            wcLog("[WC-Watch] stopWorkout: no active session")
            return
        }
        transition(to: .ending)
        session.end()
    }

    private func finalizeBuilder(at endDate: Date) {
        guard let builder else { return }
        builder.endCollection(withEnd: endDate) { [weak self] _, _ in
            self?.builder?.finishWorkout { [weak self] _, _ in
                self?.session = nil
                self?.builder = nil
            }
        }
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
        guard WCSession.default.activationState == .activated,
              WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["hr": bpm], replyHandler: nil)
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
            self.isStreaming = state == .active
            if state == .idle || state == .ended || state == .failed {
                self.heartRate = 0
            }
            self.playHaptic(for: state, from: previous)
        }
    }

    private func playHaptic(for state: WatchDisplayState, from previous: WatchDisplayState) {
        let device = WKInterfaceDevice.current()
        switch state {
        case .active where previous == .starting:
            device.play(.start)
        case .ended:
            device.play(.success)
        case .failed:
            device.play(.failure)
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
            transition(to: .active)
            publishSessionState(WatchSessionStatePayload.started)
        } else if toState == .ended {
            transition(to: .ended)
            publishSessionState(WatchSessionStatePayload.ended)
            finalizeBuilder(at: date)
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        wcLog("[WC-Watch] HKWorkoutSession didFailWithError: \(error.localizedDescription)")
        transition(to: .failed)
        publishSessionState(WatchSessionStatePayload.failed)
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        guard collectedTypes.contains(hrType),
              let stats = workoutBuilder.statistics(for: hrType),
              let quantity = stats.mostRecentQuantity() else { return }
        let bpm = Int(quantity.doubleValue(for: HKUnit(from: "count/min")))
        DispatchQueue.main.async { self.heartRate = bpm }

        // Throttle to 1 Hz — MetronomeEngine on the iPhone only consumes at 1 Hz.
        let now = Date().timeIntervalSinceReferenceDate
        if now - lastHrSendAt >= hrSendIntervalSeconds {
            lastHrSendAt = now
            sendHrToPhone(bpm)
        }
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
