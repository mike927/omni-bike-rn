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

    // Requests HealthKit authorization for EVERY read + write type the app
    // uses, in a single sheet. This previously ran as two back-to-back
    // requests — `react-native-health.initHealthKit` for the base types, then
    // a second request here for the iOS 17+ cycling metric types
    // (cyclingPower / cyclingCadence / cyclingSpeed) that react-native-health
    // does not know about. On a fresh install that hung: iOS cannot present
    // the second authorization sheet while the first is still dismissing, so
    // the second request's completion handler never fired and the connect UI
    // stuck on "Connecting..." forever. One request = one sheet = no conflict.
    AsyncFunction("requestHealthKitAuthorization") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data is not available on this device")
        return
      }

      let typesToShare: Set<HKSampleType> = [
        HKObjectType.workoutType(),
        HKQuantityType(.activeEnergyBurned),
        HKQuantityType(.basalEnergyBurned),
        HKQuantityType(.distanceCycling),
        HKQuantityType(.heartRate),
        HKQuantityType(.cyclingPower),
        HKQuantityType(.cyclingCadence),
        HKQuantityType(.cyclingSpeed),
      ]
      let typesToRead: Set<HKObjectType> = [
        HKQuantityType(.basalEnergyBurned),
        HKCharacteristicType(.biologicalSex),
        HKCharacteristicType(.dateOfBirth),
        HKQuantityType(.bodyMass),
        HKQuantityType(.height),
      ]

      self.healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { success, error in
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

    // Sums `basalEnergyBurned` samples over the workout interval, filtering out
    // this app's own prior writes so a re-export of the same session doesn't
    // read back the basal sample we attached on the previous save and compound
    // it into the next Total.
    AsyncFunction("queryBasalEnergyKcal") { (options: [String: Any], promise: Promise) in
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

      let basalType = HKQuantityType(.basalEnergyBurned)
      // Basal samples are interval-based (multi-minute buckets), so strict
      // bounds would drop any sample that straddles the workout start/end
      // and under-count to zero. Default (non-strict) predicate picks up
      // overlapping samples; we then pro-rate each by the fraction of its
      // interval that actually falls inside the workout window rather than
      // summing the full value (HKStatisticsQuery .cumulativeSum would do
      // the latter and over-count).
      let timePredicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: [])
      let notFromSelf = NSCompoundPredicate(
        notPredicateWithSubpredicate: HKQuery.predicateForObjects(from: [HKSource.default()])
      )
      let combined = NSCompoundPredicate(andPredicateWithSubpredicates: [timePredicate, notFromSelf])

      let query = HKSampleQuery(
        sampleType: basalType,
        predicate: combined,
        limit: HKObjectQueryNoLimit,
        sortDescriptors: nil
      ) { _, samples, error in
        if let error {
          promise.reject("ERR_QUERY_FAILED", error.localizedDescription)
          return
        }
        guard let quantitySamples = samples as? [HKQuantitySample] else {
          promise.resolve(0.0)
          return
        }
        var totalKcal: Double = 0
        for sample in quantitySamples {
          let sampleDuration = sample.endDate.timeIntervalSince(sample.startDate)
          guard sampleDuration > 0 else { continue }
          let overlapStart = max(sample.startDate, startDate)
          let overlapEnd = min(sample.endDate, endDate)
          let overlapDuration = overlapEnd.timeIntervalSince(overlapStart)
          guard overlapDuration > 0 else { continue }
          let fraction = min(overlapDuration / sampleDuration, 1.0)
          let sampleKcal = sample.quantity.doubleValue(for: .kilocalorie())
          totalKcal += sampleKcal * fraction
        }
        promise.resolve(totalKcal)
      }
      self.healthStore.execute(query)
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
      let rawWorkoutEvents = options["workoutEvents"] as? [[String: Any]] ?? []

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

        // Omit when 0 so Apple Fitness falls back to Active == Total (pre-split behavior).
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

        // Pause / resume events are what make HealthKit report the ride's active
        // duration instead of its wall-clock span: HKWorkoutBuilder excludes the
        // interval between a pause and the next resume from the workout's
        // elapsed time. They must be added before endCollection.
        let workoutEvents = self.buildWorkoutEvents(
          from: rawWorkoutEvents,
          rangeStart: startDate,
          rangeEnd: endDate
        )

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

        let addEventsThenFinalize: () -> Void = {
          guard !workoutEvents.isEmpty else {
            finalize()
            return
          }

          // Deliberately log and carry on rather than fail the save. Losing the
          // events costs the ride the duration correction this change adds,
          // which is the wrong duration every paused ride already exported
          // before it. Rejecting here would instead cost the user the whole
          // ride, samples and all, on a path that used to succeed, and nothing
          // the app can retry would make HealthKit accept an array it just
          // refused. A workout with a wrong duration beats no workout. This is
          // how addMetadata above treats enrichment too. Samples stay fail
          // loud: they are the ride, not a correction to it.
          builder.addWorkoutEvents(workoutEvents) { success, error in
            if let error {
              NSLog(
                "[AppleHealthWorkoutModule] addWorkoutEvents failed, saving the ride without its pause events: %@",
                error.localizedDescription
              )
            } else if !success {
              NSLog(
                "[AppleHealthWorkoutModule] addWorkoutEvents reported failure without error, saving the ride without its pause events"
              )
            }
            finalize()
          }
        }

        if samplesToAdd.isEmpty {
          addEventsThenFinalize()
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
          addEventsThenFinalize()
        }
      }
    }
  }

  private func buildWorkoutEvents(
    from rawEvents: [[String: Any]],
    rangeStart: Date,
    rangeEnd: Date
  ) -> [HKWorkoutEvent] {
    return rawEvents.compactMap { rawEvent in
      guard
        let rawType = rawEvent["type"] as? String,
        let timestampMs = (rawEvent["timestampMs"] as? NSNumber)?.doubleValue,
        timestampMs.isFinite
      else { return nil }

      let eventType: HKWorkoutEventType
      switch rawType {
      case "pause": eventType = .pause
      case "resume": eventType = .resume
      default: return nil
      }

      let date = Date(timeIntervalSince1970: timestampMs / 1000)
      // HealthKit rejects an event outside the workout's own interval, which
      // would fail the whole save. The JS side already clamps; this is the
      // same guard the sample builder applies, for the same reason.
      guard date >= rangeStart && date <= rangeEnd else { return nil }

      return HKWorkoutEvent(
        type: eventType,
        dateInterval: DateInterval(start: date, duration: 0),
        metadata: nil
      )
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
