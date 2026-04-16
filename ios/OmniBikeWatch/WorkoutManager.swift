import Foundation
import HealthKit
import WatchConnectivity

final class WorkoutManager: NSObject, ObservableObject {
    // ── Published state ────────────────────────────────────────────────────────
    @Published var heartRate: Int = 0
    @Published var isStreaming: Bool = false

    // ── Private state ──────────────────────────────────────────────────────────
    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    private let hrType = HKQuantityType(.heartRate)

    // ── HealthKit authorization ────────────────────────────────────────────────

    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: [hrType]) { _, _ in }
        activateWCSession()
    }

    // ── WatchConnectivity ──────────────────────────────────────────────────────

    private func activateWCSession() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // ── Workout lifecycle ──────────────────────────────────────────────────────

    func startWorkout() {
        let config = HKWorkoutConfiguration()
        config.activityType = .cycling
        config.locationType = .indoor

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
            print("[WorkoutManager] startWorkout failed: \(error)")
        }
    }

    func stopWorkout() {
        session?.end()
        builder?.endCollection(withEnd: Date()) { _, _ in
            self.builder?.finishWorkout { _, _ in }
        }
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
}

// MARK: - HKWorkoutSessionDelegate

extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
                        from fromState: HKWorkoutSessionState, date: Date) {}

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("[WorkoutManager] Session failed: \(error)")
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
        sendHrToPhone(bpm)
    }
}

// MARK: - WCSessionDelegate

extension WorkoutManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {}

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let cmd = message["cmd"] as? String else { return }
        if cmd == "startHr" {
            startWorkout()
        } else if cmd == "stopHr" {
            stopWorkout()
        }
    }
}
