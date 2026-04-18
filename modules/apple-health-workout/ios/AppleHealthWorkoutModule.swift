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
      let rawHrSamples = options["heartRateSamples"] as? [[String: Any]] ?? []

      let configuration = HKWorkoutConfiguration()
      configuration.activityType = .cycling
      configuration.locationType = .indoor

      let builder = HKWorkoutBuilder(
        healthStore: self.healthStore,
        configuration: configuration,
        device: .local()
      )
      builder.addMetadata([HKMetadataKeyIndoorWorkout: true]) { success, error in
        if let error {
          NSLog("[AppleHealthWorkoutModule] addMetadata failed: %@", error.localizedDescription)
          return
        }
        if !success {
          NSLog("[AppleHealthWorkoutModule] addMetadata reported failure without error")
        }
      }

      builder.beginCollection(withStart: startDate) { success, error in
        if let error {
          promise.reject("ERR_BEGIN_FAILED", error.localizedDescription)
          return
        }
        guard success else {
          promise.reject("ERR_BEGIN_FAILED", "HealthKit reported beginCollection failure without error")
          return
        }

        var samplesToAdd: [HKSample] = []

        if totalEnergyKcal > 0 {
          let energyQuantity = HKQuantity(unit: .kilocalorie(), doubleValue: totalEnergyKcal)
          samplesToAdd.append(HKCumulativeQuantitySample(
            type: HKQuantityType(.activeEnergyBurned),
            quantity: energyQuantity,
            start: startDate,
            end: endDate
          ))
        }

        if totalDistanceMeters > 0 {
          let distanceQuantity = HKQuantity(unit: .meter(), doubleValue: totalDistanceMeters)
          samplesToAdd.append(HKCumulativeQuantitySample(
            type: HKQuantityType(.distanceCycling),
            quantity: distanceQuantity,
            start: startDate,
            end: endDate
          ))
        }

        samplesToAdd.append(contentsOf: self.buildHeartRateSamples(
          from: rawHrSamples, rangeStart: startDate, rangeEnd: endDate
        ))

        let finalize: () -> Void = {
          builder.endCollection(withEnd: endDate) { success, error in
            if let error {
              promise.reject("ERR_END_FAILED", error.localizedDescription)
              return
            }
            guard success else {
              promise.reject("ERR_END_FAILED", "HealthKit reported endCollection failure without error")
              return
            }
            builder.finishWorkout { workout, error in
              if let error {
                promise.reject("ERR_SAVE_FAILED", error.localizedDescription)
                return
              }
              guard let workout else {
                promise.reject("ERR_SAVE_FAILED", "HealthKit returned no workout")
                return
              }
              promise.resolve(workout.uuid.uuidString)
            }
          }
        }

        if samplesToAdd.isEmpty {
          finalize()
          return
        }

        builder.add(samplesToAdd) { success, error in
          if let error {
            promise.reject("ERR_ADD_SAMPLES_FAILED", error.localizedDescription)
            return
          }
          guard success else {
            promise.reject("ERR_ADD_SAMPLES_FAILED", "HealthKit reported add samples failure without error")
            return
          }
          finalize()
        }
      }
    }
  }

  private func buildHeartRateSamples(
    from rawSamples: [[String: Any]],
    rangeStart: Date,
    rangeEnd: Date
  ) -> [HKQuantitySample] {
    let hrType = HKQuantityType(.heartRate)
    let unit = HKUnit(from: "count/min")
    return rawSamples.compactMap { sample in
      guard
        let bpm = (sample["bpm"] as? NSNumber)?.doubleValue, bpm > 0,
        let timestampMs = (sample["timestampMs"] as? NSNumber)?.doubleValue
      else { return nil }
      let date = Date(timeIntervalSince1970: timestampMs / 1000)
      guard date >= rangeStart && date <= rangeEnd else { return nil }
      let quantity = HKQuantity(unit: unit, doubleValue: bpm)
      return HKQuantitySample(type: hrType, quantity: quantity, start: date, end: date)
    }
  }

  private func parseDate(_ s: String) -> Date? {
    isoFormatter.date(from: s) ?? isoFormatterNoFrac.date(from: s)
  }
}
