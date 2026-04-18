import ExpoModulesCore
import HealthKit

public class AppleHealthWorkoutModule: Module {
  private let healthStore = HKHealthStore()
  private let isoFormatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()
  private let isoFormatterNoFrac: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
  }()

  public func definition() -> ModuleDefinition {
    Name("AppleHealthWorkout")

    AsyncFunction("saveCyclingWorkout") { (options: [String: Any], promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data is not available on this device")
        return
      }

      guard
        let startString = options["startDate"] as? String,
        let endString = options["endDate"] as? String,
        let startDate = self.parseDate(startString),
        let endDate = self.parseDate(endString)
      else {
        promise.reject("ERR_INVALID_DATES", "startDate/endDate must be ISO-8601 strings")
        return
      }

      let totalEnergyKcal = (options["totalEnergyKcal"] as? NSNumber)?.doubleValue ?? 0
      let totalDistanceMeters = (options["totalDistanceMeters"] as? NSNumber)?.doubleValue ?? 0

      let energyQuantity = HKQuantity(unit: .kilocalorie(), doubleValue: totalEnergyKcal)
      let distanceQuantity = HKQuantity(unit: .meter(), doubleValue: totalDistanceMeters)

      let metadata: [String: Any] = [
        HKMetadataKeyIndoorWorkout: true
      ]

      let workout = HKWorkout(
        activityType: .cycling,
        start: startDate,
        end: endDate,
        workoutEvents: nil,
        totalEnergyBurned: energyQuantity,
        totalDistance: distanceQuantity,
        metadata: metadata
      )

      self.healthStore.save(workout) { success, error in
        if let error {
          promise.reject("ERR_SAVE_FAILED", error.localizedDescription)
          return
        }
        guard success else {
          promise.reject("ERR_SAVE_FAILED", "HealthKit reported save failure without error")
          return
        }
        promise.resolve(workout.uuid.uuidString)
      }
    }
  }

  private func parseDate(_ s: String) -> Date? {
    isoFormatter.date(from: s) ?? isoFormatterNoFrac.date(from: s)
  }
}
