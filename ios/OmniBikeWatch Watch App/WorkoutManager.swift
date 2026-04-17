import Combine
import Foundation
import HealthKit
import WatchConnectivity

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

final class WorkoutManager: NSObject, ObservableObject {
    static let shared = WorkoutManager()

    // ── Published state ────────────────────────────────────────────────────────
    @Published var heartRate: Int = 0
    @Published var isStreaming: Bool = false

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
    }

    // ── HealthKit authorization ────────────────────────────────────────────────

    func requestAuthorization(starting configuration: HKWorkoutConfiguration? = nil) {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [hrType]) { [weak self] success, error in
            if let error {
                print("[WorkoutManager] Authorization failed: \(error)")
                return
            }

            guard success else {
                print("[WorkoutManager] Authorization denied")
                return
            }

            if let configuration {
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
        if session != nil {
            DispatchQueue.main.async { self.isStreaming = true }
            return
        }

        let config = configuration ?? defaultWorkoutConfiguration()

        do {
            session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            builder = session?.associatedWorkoutBuilder()
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
            session?.delegate = self
            builder?.delegate = self
            session?.startActivity(with: Date())
            builder?.beginCollection(withStart: Date()) { _, _ in }
            DispatchQueue.main.async { self.isStreaming = true }
        } catch {
            NSLog("[WorkoutManager] startWorkout failed: \(error.localizedDescription)")
        }
    }

    func stopWorkout() {
        session?.end()
        builder?.endCollection(withEnd: Date()) { [weak self] _, _ in
            self?.builder?.finishWorkout { [weak self] _, _ in
                self?.session = nil
                self?.builder = nil
            }
        }
        lastHrSendAt = 0
        DispatchQueue.main.async {
            self.isStreaming = false
            self.heartRate = 0
        }
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
}

// MARK: - HKWorkoutSessionDelegate

extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
                        from fromState: HKWorkoutSessionState, date: Date) {
        if toState == .running {
            publishSessionState(WatchSessionStatePayload.started)
        } else if toState == .ended {
            publishSessionState(WatchSessionStatePayload.ended)
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
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
