import ExpoModulesCore
import HealthKit
import WatchConnectivity

public class WatchConnectivityModule: Module {
  fileprivate var activationPromise: Promise?
  private let healthStore = HKHealthStore()
  private lazy var sessionDelegate: SessionDelegateProxy = SessionDelegateProxy(module: self)

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivity")

    Events("onWatchHr", "onReachabilityChange")

    AsyncFunction("activate") { (promise: Promise) in
      guard WCSession.isSupported() else {
        promise.reject("ERR_NOT_SUPPORTED", "WatchConnectivity is not supported on this device")
        return
      }
      let session = WCSession.default
      if session.activationState == .activated {
        promise.resolve()
        return
      }
      if self.activationPromise != nil {
        promise.reject("ERR_ACTIVATION_IN_PROGRESS", "WCSession activation is already in progress")
        return
      }
      self.activationPromise = promise
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

      self.healthStore.startWatchApp(with: configuration) { success, error in
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
    }

    Function("sendMessage") { (message: [String: Any]) -> Bool in
      let session = WCSession.default
      guard session.activationState == .activated, session.isReachable else { return false }
      session.sendMessage(message, replyHandler: nil)
      return true
    }
  }

  fileprivate func emitHr(_ hr: Int) {
    sendEvent("onWatchHr", ["hr": hr])
  }

  fileprivate func emitReachability(_ reachable: Bool) {
    sendEvent("onReachabilityChange", ["reachable": reachable])
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
    if let err = error {
      module?.activationPromise?.reject("ERR_ACTIVATION_FAILED", err.localizedDescription)
    } else {
      module?.activationPromise?.resolve()
    }
    module?.activationPromise = nil
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if let hr = message["hr"] as? NSNumber {
      module?.emitHr(hr.intValue)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    module?.emitReachability(session.isReachable)
  }
}
