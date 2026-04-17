import Combine
import Foundation
import HealthKit
import WatchConnectivity
import WatchKit

/// Command tokens exchanged with the iPhone app via WatchConnectivity.
/// Must stay in sync with the TypeScript constants in `WatchHrAdapter.ts`.
enum WatchCommand {
    static let startHr = "startHr"
    static let stopHr = "stopHr"
}

enum WatchSessionStatePayload {
    static let started = "started"
    static let ended = "ended"
    static let failed = "failed"
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
    private var pendingStartRequest = false

    private let hrType = HKQuantityType(.heartRate)
    private let hrSendIntervalSeconds: TimeInterval = 1.0

    override private init() {
        super.init()
        activateWCSession()
    }

    // ── HealthKit authorization ────────────────────────────────────────────────

    func requestAuthorization(starting configuration: HKWorkoutConfiguration? = nil) {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        if configuration != nil {
            pendingStartRequest = true
            transition(to: .starting)
        }
        healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [hrType]) { [weak self] success, error in
            if let error {
                self?.pendingStartRequest = false
                self?.transition(to: .failed)
                print("[WorkoutManager] Authorization failed: \(error)")
                return
            }

            guard success else {
                self?.pendingStartRequest = false
                self?.transition(to: .failed)
                print("[WorkoutManager] Authorization denied")
                return
            }

            if let configuration {
                guard self?.pendingStartRequest == true else { return }
                self?.pendingStartRequest = false
                self?.startWorkout(configuration: configuration)
            }
        }
    }

    // ── WatchConnectivity ──────────────────────────────────────────────────────

    private func activateWCSession() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // ── Workout lifecycle ──────────────────────────────────────────────────────

    func startWorkout(configuration: HKWorkoutConfiguration? = nil) {
        pendingStartRequest = false
        if session != nil {
            transition(to: .active)
            return
        }

        transition(to: .starting)
        let config = configuration ?? defaultWorkoutConfiguration()

        do {
            session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            builder = session?.associatedWorkoutBuilder()
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
            session?.delegate = self
            builder?.delegate = self
            session?.startActivity(with: Date())
            builder?.beginCollection(withStart: Date()) { _, _ in }
        } catch {
            transition(to: .failed)
            NSLog("[WorkoutManager] startWorkout failed: \(error.localizedDescription)")
        }
    }

    func stopWorkout() {
        pendingStartRequest = false
        transition(to: .ending)

        guard session != nil || builder != nil else {
            transition(to: .ended)
            publishSessionState(WatchSessionStatePayload.ended)
            return
        }

        session?.end()
        builder?.endCollection(withEnd: Date()) { [weak self] _, _ in
            self?.builder?.finishWorkout { [weak self] _, _ in
                self?.session = nil
                self?.builder = nil
            }
        }
        lastHrSendAt = 0
    }

    // ── HR dispatch ───────────────────────────────────────────────────────────

    private func sendHrToPhone(_ bpm: Int) {
        guard WCSession.default.activationState == .activated,
              WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["hr": bpm], replyHandler: nil)
    }

    private func defaultWorkoutConfiguration() -> HKWorkoutConfiguration {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .cycling
        configuration.locationType = .indoor
        return configuration
    }

    private func publishSessionState(_ state: String) {
        let payload: [String: Any] = [
            "sessionState": state,
            "sentAtMs": Date().timeIntervalSince1970 * 1000,
        ]
        let session = WCSession.default

        if session.activationState == .activated, session.isReachable {
            session.sendMessage(payload, replyHandler: nil)
        }

        guard session.activationState == .activated else {
            pendingSessionStatePayload = payload
            return
        }

        do {
            try session.updateApplicationContext(payload)
        } catch {
            NSLog("[WorkoutManager] Failed to publish watch session state: \(error.localizedDescription)")
        }
    }

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
        if toState == .running {
            transition(to: .active)
            publishSessionState(WatchSessionStatePayload.started)
        } else if toState == .ended {
            transition(to: .ended)
            publishSessionState(WatchSessionStatePayload.ended)
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        transition(to: .failed)
        publishSessionState(WatchSessionStatePayload.failed)
        NSLog("[WorkoutManager] Session failed: \(error.localizedDescription)")
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
        guard activationState == .activated, error == nil, let payload = pendingSessionStatePayload else { return }
        pendingSessionStatePayload = nil

        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil)
        }

        do {
            try session.updateApplicationContext(payload)
        } catch {
            NSLog("[WorkoutManager] Failed to flush pending watch session state: \(error.localizedDescription)")
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let cmd = message["cmd"] as? String else { return }
        if cmd == WatchCommand.startHr {
            requestAuthorization(starting: defaultWorkoutConfiguration())
            return
        }
        if cmd == WatchCommand.stopHr {
            stopWorkout()
        }
    }
}
