import ExpoModulesCore
import HealthKit
import WatchConnectivity

fileprivate enum PayloadKey {
  static let heartRate = "hr"
  static let sessionState = "sessionState"
  static let sentAtMs = "sentAtMs"
}

public class WatchConnectivityModule: Module {
  private let stateQueue = DispatchQueue(label: "com.omnibike.watchconnectivity.state")
  fileprivate var activationPromise: Promise?
  private let healthStore = HKHealthStore()
  private lazy var sessionDelegate: SessionDelegateProxy = SessionDelegateProxy(module: self)

  private static let startWatchAppTimeout: TimeInterval = 10

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivity")

    Events("onWatchHr", "onReachabilityChange", "onWatchSessionState")

    AsyncFunction("activate") { (promise: Promise) in
      guard WCSession.isSupported() else {
        promise.reject("ERR_NOT_SUPPORTED", "WatchConnectivity is not supported on this device")
        return
      }
      let session = WCSession.default
      if session.activationState == .activated {
        self.emitReachability(session.isReachable)
        promise.resolve()
        return
      }
      var alreadyInProgress = false
      self.stateQueue.sync {
        if self.activationPromise != nil {
          alreadyInProgress = true
        } else {
          self.activationPromise = promise
        }
      }
      if alreadyInProgress {
        promise.reject("ERR_ACTIVATION_IN_PROGRESS", "WCSession activation is already in progress")
        return
      }
      session.delegate = self.sessionDelegate
      session.activate()
    }

    AsyncFunction("startWatchApp") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data is not available on this device")
        return
      }

      let configuration = HKWorkoutConfiguration()
      configuration.activityType = .cycling
      configuration.locationType = .indoor

      // `startWatchApp(with:)` requires the iOS app to be authorized to share
      // workouts. Without that grant HealthKit silently no-ops but still calls
      // the completion handler with success=true, so the Watch app never
      // launches and the failure is invisible to the caller. Request auth up
      // front; the dialog is shown once on first run, then becomes a no-op.
      self.healthStore.requestAuthorization(toShare: [HKObjectType.workoutType()], read: []) { authSuccess, authError in
        if let authError {
          promise.reject("ERR_HEALTH_AUTH_FAILED", authError.localizedDescription)
          return
        }
        guard authSuccess else {
          promise.reject("ERR_HEALTH_AUTH_FAILED", "HealthKit authorization denied")
          return
        }

        // Race the HealthKit launch against a timeout so a sleeping or out-of-range
        // Watch does not leave the JS caller pending forever. Either callback
        // settling the promise first wins; `resolved` makes the late-arriving side
        // a no-op.
        var resolved = false
        let settle: (() -> Void) = { [weak self] in
          self?.stateQueue.sync { resolved = true }
        }
        let isAlreadyResolved: (() -> Bool) = { [weak self] in
          var done = false
          self?.stateQueue.sync { done = resolved }
          return done
        }

        self.healthStore.startWatchApp(with: configuration) { success, error in
          if isAlreadyResolved() { return }
          settle()
          if let error {
            promise.reject("ERR_START_WATCH_APP_FAILED", error.localizedDescription)
            return
          }
          guard success else {
            promise.reject("ERR_START_WATCH_APP_FAILED", "Apple Watch app could not be launched")
            return
          }
          promise.resolve()
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + Self.startWatchAppTimeout) {
          if isAlreadyResolved() { return }
          settle()
          promise.reject(
            "ERR_START_WATCH_APP_FAILED",
            "Apple Watch app could not be launched within \(Int(Self.startWatchAppTimeout))s"
          )
        }
      }
    }

    Function("sendMessage") { (message: [String: Any]) -> Bool in
      let session = WCSession.default
      guard session.activationState == .activated, session.isReachable else {
        print("[WatchConnectivity] sendMessage dropped — session not activated or Watch unreachable")
        return false
      }
      session.sendMessage(message, replyHandler: nil)
      return true
    }
  }

  fileprivate func resolveActivation(with error: Error?) {
    var promise: Promise?
    stateQueue.sync {
      promise = activationPromise
      activationPromise = nil
    }
    if let err = error {
      promise?.reject("ERR_ACTIVATION_FAILED", err.localizedDescription)
    } else {
      emitReachability(WCSession.default.isReachable)
      promise?.resolve()
    }
  }

  fileprivate func emitHr(_ hr: Int) {
    sendEvent("onWatchHr", ["hr": hr])
  }

  fileprivate func emitReachability(_ reachable: Bool) {
    sendEvent("onReachabilityChange", ["reachable": reachable])
  }

  fileprivate func emitSessionState(_ state: String, sentAtMs: Double) {
    sendEvent("onWatchSessionState", ["state": state, "sentAtMs": sentAtMs])
  }
}

private class SessionDelegateProxy: NSObject, WCSessionDelegate {
  weak var module: WatchConnectivityModule?

  init(module: WatchConnectivityModule) {
    self.module = module
    super.init()
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    module?.resolveActivation(with: error)
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if let hr = message[PayloadKey.heartRate] as? NSNumber {
      module?.emitHr(hr.intValue)
    }
    if let state = message[PayloadKey.sessionState] as? String,
       let sentAtMs = message[PayloadKey.sentAtMs] as? NSNumber {
      module?.emitSessionState(state, sentAtMs: sentAtMs.doubleValue)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    if let state = applicationContext[PayloadKey.sessionState] as? String,
       let sentAtMs = applicationContext[PayloadKey.sentAtMs] as? NSNumber {
      module?.emitSessionState(state, sentAtMs: sentAtMs.doubleValue)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    module?.emitReachability(session.isReachable)
  }
}
