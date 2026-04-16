import ExpoModulesCore
import WatchConnectivity

public class WatchConnectivityModule: Module, WCSessionDelegate {
  private var activationPromise: Promise?

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivity")

    Events("onWatchHr", "onReachabilityChange")

    Function("isSupported") { () -> Bool in
      WCSession.isSupported()
    }

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
        // Activation already in flight — reject the new caller immediately
        promise.reject("ERR_ACTIVATION_IN_PROGRESS", "WCSession activation is already in progress")
        return
      }
      self.activationPromise = promise
      session.delegate = self
      session.activate()
    }

    Function("sendMessage") { (message: [String: Any]) in
      let session = WCSession.default
      guard session.activationState == .activated, session.isReachable else { return }
      session.sendMessage(message, replyHandler: nil)
    }
  }

  // MARK: - WCSessionDelegate

  public func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let err = error {
      activationPromise?.reject("ERR_ACTIVATION_FAILED", err.localizedDescription)
    } else {
      activationPromise?.resolve()
    }
    activationPromise = nil
  }

  public func sessionDidBecomeInactive(_ session: WCSession) {}

  public func sessionDidDeactivate(_ session: WCSession) {
    // Re-activate to support Watch switching
    WCSession.default.activate()
  }

  public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if let hr = message["hr"] as? NSNumber {
      sendEvent("onWatchHr", ["hr": hr.intValue])
    }
  }

  public func sessionReachabilityDidChange(_ session: WCSession) {
    sendEvent("onReachabilityChange", ["reachable": session.isReachable])
  }
}
