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

    // Requests write authorization for the iOS 17+ cycling metric types that
    // `react-native-health` does not know about (cyclingPower / cyclingCadence /
    // cyclingSpeed). The plain Workout / ActiveEnergyBurned / DistanceCycling /
    // HeartRate types are still requested via `react-native-health.initHealthKit`.
    AsyncFunction("requestCyclingMetricsAuthorization") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data is not available on this device")
        return
      }

      let typesToShare: Set<HKSampleType> = [
        HKQuantityType(.cyclingPower),
        HKQuantityType(.cyclingCadence),
        HKQuantityType(.cyclingSpeed),
      ]

      self.healthStore.requestAuthorization(toShare: typesToShare, read: []) { success, error in
        if let error {
          promise.reject("ERR_AUTH_FAILED", error.localizedDescription)
          return
        }
        guard success else {
          promise.reject("ERR_AUTH_FAILED", "HealthKit reported authorization failure without error")
          return
        }
        promise.resolve(nil)
      }
    }

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

      let activeEnergyKcal = (options["activeEnergyKcal"] as? NSNumber)?.doubleValue ?? 0
      let basalEnergyKcal = (options["basalEnergyKcal"] as? NSNumber)?.doubleValue ?? 0
      let totalDistanceMeters = (options["totalDistanceMeters"] as? NSNumber)?.doubleValue ?? 0
      let rawHrSamples = options["heartRateSamples"] as? [[String: Any]] ?? []
      let rawPowerSamples = options["cyclingPowerSamples"] as? [[String: Any]] ?? []
      let rawCadenceSamples = options["cyclingCadenceSamples"] as? [[String: Any]] ?? []
      let rawSpeedSamples = options["cyclingSpeedSamples"] as? [[String: Any]] ?? []

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

        if activeEnergyKcal > 0 {
          let activeEnergyQuantity = HKQuantity(unit: .kilocalorie(), doubleValue: activeEnergyKcal)
          samplesToAdd.append(HKCumulativeQuantitySample(
            type: HKQuantityType(.activeEnergyBurned),
            quantity: activeEnergyQuantity,
            start: startDate,
            end: endDate
          ))
        }

        // Basal sample is optional — the JS caller passes 0 when HealthKit
        // basal data is unavailable. Omitting it causes Apple Fitness to
        // render Total == Active (pre-split behavior), which is the safe
        // graceful-degradation path.
        if basalEnergyKcal > 0 {
          let basalEnergyQuantity = HKQuantity(unit: .kilocalorie(), doubleValue: basalEnergyKcal)
          samplesToAdd.append(HKCumulativeQuantitySample(
            type: HKQuantityType(.basalEnergyBurned),
            quantity: basalEnergyQuantity,
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

        // Heart rate uses `bpm` key and requires strictly positive values
        // (bpm == 0 is nonsensical and treated as "no reading"). The three
        // cycling-metric arrays use a generic `value` key and accept 0 as a
        // meaningful "not pedaling" sample. Units are documented on the JS side.
        samplesToAdd.append(contentsOf: self.buildQuantitySamples(
          from: rawHrSamples,
          valueKey: "bpm",
          type: HKQuantityType(.heartRate),
          unit: HKUnit(from: "count/min"),
          requirePositive: true,
          rangeStart: startDate,
          rangeEnd: endDate
        ))
        samplesToAdd.append(contentsOf: self.buildQuantitySamples(
          from: rawPowerSamples,
          valueKey: "value",
          type: HKQuantityType(.cyclingPower),
          unit: .watt(),
          requirePositive: false,
          rangeStart: startDate,
          rangeEnd: endDate
        ))
        samplesToAdd.append(contentsOf: self.buildQuantitySamples(
          from: rawCadenceSamples,
          valueKey: "value",
          type: HKQuantityType(.cyclingCadence),
          unit: HKUnit.count().unitDivided(by: .minute()),
          requirePositive: false,
          rangeStart: startDate,
          rangeEnd: endDate
        ))
        samplesToAdd.append(contentsOf: self.buildQuantitySamples(
          from: rawSpeedSamples,
          valueKey: "value",
          type: HKQuantityType(.cyclingSpeed),
          unit: HKUnit.meter().unitDivided(by: .second()),
          requirePositive: false,
          rangeStart: startDate,
          rangeEnd: endDate
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

  private func buildQuantitySamples(
    from rawSamples: [[String: Any]],
    valueKey: String,
    type: HKQuantityType,
    unit: HKUnit,
    requirePositive: Bool,
    rangeStart: Date,
    rangeEnd: Date
  ) -> [HKQuantitySample] {
    return rawSamples.compactMap { sample in
      guard
        let value = (sample[valueKey] as? NSNumber)?.doubleValue,
        value.isFinite,
        (requirePositive ? value > 0 : value >= 0),
        let timestampMs = (sample["timestampMs"] as? NSNumber)?.doubleValue
      else { return nil }
      let date = Date(timeIntervalSince1970: timestampMs / 1000)
      guard date >= rangeStart && date <= rangeEnd else { return nil }
      let quantity = HKQuantity(unit: unit, doubleValue: value)
      return HKQuantitySample(type: type, quantity: quantity, start: date, end: date)
    }
  }

  private func parseDate(_ s: String) -> Date? {
    isoFormatter.date(from: s) ?? isoFormatterNoFrac.date(from: s)
  }
}
