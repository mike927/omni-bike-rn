import ExpoModulesCore
import HealthKit
import WatchConnectivity

fileprivate enum WCFileLog {
  static let url: URL = {
    let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    let u = dir.appendingPathComponent("wc.log")
    try? "=== iPhone WC log started \(Date()) ===\n".write(to: u, atomically: false, encoding: .utf8)
    return u
  }()
  private static let formatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "HH:mm:ss.SSS"
    return f
  }()
  static func write(_ line: String) {
    let ts = formatter.string(from: Date())
    let entry = "[\(ts)] \(line)\n"
    if let data = entry.data(using: .utf8) {
      if let handle = try? FileHandle(forWritingTo: url) {
        handle.seekToEndOfFile()
        handle.write(data)
        try? handle.close()
      } else {
        try? entry.write(to: url, atomically: false, encoding: .utf8)
      }
    }
  }
}

fileprivate func wcLog(_ message: String) {
  NSLog("%@", message)
  WCFileLog.write(message)
}

fileprivate enum PayloadKey {
  static let heartRate = "hr"
  static let sessionState = "sessionState"
  static let sentAtMs = "sentAtMs"
  static let command = "cmd"
}

fileprivate enum WatchCommand {
  static let start = "start"
  static let stop = "stop"
}

public class WatchConnectivityModule: Module {
  private let stateQueue = DispatchQueue(label: "com.omnibike.watchconnectivity.state")
  fileprivate var activationPromise: Promise?
  private let healthStore = HKHealthStore()
  private lazy var sessionDelegate: SessionDelegateProxy = SessionDelegateProxy(module: self)
  fileprivate var pendingStart: Bool = false

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivity")

    Events("onWatchHr", "onReachabilityChange", "onWatchSessionState")

    // Per WWDC23 session 10023: register the mirroring handler on every app
    // launch (foreground or background) so HealthKit can hand us the primary
    // session that the Watch created. Without this, `startMirroringToCompanionDevice`
    // on the Watch has nothing to mirror to.
    OnCreate {
      wcLog("[WC-iPhone] OnCreate: registering workoutSessionMirroringStartHandler")
      self.healthStore.workoutSessionMirroringStartHandler = { mirroredSession in
        wcLog("[WC-iPhone] workoutSessionMirroringStartHandler fired state=\(mirroredSession.state.rawValue)")
      }
    }

    AsyncFunction("activate") { (promise: Promise) in
      wcLog("[WC-iPhone] activate() called")
      guard WCSession.isSupported() else {
        wcLog("[WC-iPhone] activate: WCSession not supported")
        promise.reject("ERR_NOT_SUPPORTED", "WatchConnectivity is not supported on this device")
        return
      }
      let session = WCSession.default
      wcLog("[WC-iPhone] activate: state=\(session.activationState.rawValue) paired=\(session.isPaired) installed=\(session.isWatchAppInstalled) reachable=\(session.isReachable)")
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

    // Wakes the Watch companion app and passes it an HKWorkoutConfiguration.
    // The Watch app receives it via `WKApplicationDelegate.handle(_:)`.
    AsyncFunction("startWatchApp") { (promise: Promise) in
      wcLog("[WC-iPhone] startWatchApp() called")
      guard HKHealthStore.isHealthDataAvailable() else {
        wcLog("[WC-iPhone] startWatchApp: Health data not available")
        promise.reject("ERR_HEALTH_UNAVAILABLE", "Health data is not available on this device")
        return
      }

      let configuration = HKWorkoutConfiguration()
      configuration.activityType = .cycling
      configuration.locationType = .indoor

      let wcSession = WCSession.default
      wcLog("[WC-iPhone] startWatchApp: WC state=\(wcSession.activationState.rawValue) paired=\(wcSession.isPaired) installed=\(wcSession.isWatchAppInstalled) reachable=\(wcSession.isReachable)")

      wcLog("[WC-iPhone] startWatchApp: invoking HKHealthStore.startWatchApp")
      self.pendingStart = true
      self.healthStore.startWatchApp(with: configuration) { success, error in
        if let error {
          wcLog("[WC-iPhone] startWatchApp: FAILED with error: \(error.localizedDescription)")
          self.pendingStart = false
          promise.reject("ERR_START_WATCH_APP_FAILED", error.localizedDescription)
          return
        }
        guard success else {
          wcLog("[WC-iPhone] startWatchApp: FAILED success=false")
          self.pendingStart = false
          promise.reject("ERR_START_WATCH_APP_FAILED", "HealthKit could not launch the Watch app")
          return
        }
        wcLog("[WC-iPhone] startWatchApp: SUCCESS — scheduling start cmd")
        self.flushPendingStart()
        promise.resolve()
      }
    }

    // Tells the Watch companion app to end its running workout. Delivered as
    // a WC message — the Watch owns the HKWorkoutSession lifecycle, so only
    // it can call `session.end()`.
    AsyncFunction("endMirroredWorkout") { (promise: Promise) in
      wcLog("[WC-iPhone] endMirroredWorkout() called")
      let session = WCSession.default
      guard session.activationState == .activated else {
        wcLog("[WC-iPhone] endMirroredWorkout: dropping — WC not activated")
        promise.resolve()
        return
      }
      let stopPayload = [PayloadKey.command: WatchCommand.stop]
      if session.isReachable {
        wcLog("[WC-iPhone] endMirroredWorkout: sending stop via sendMessage")
        session.sendMessage(stopPayload, replyHandler: nil)
      } else {
        // Watch unreachable — queue via transferUserInfo so FIFO delivery ends
        // any orphaned HKWorkoutSession the next time the Watch wakes. Without
        // this, the Watch session runs indefinitely until the user kills the app.
        wcLog("[WC-iPhone] endMirroredWorkout: unreachable — queuing stop via transferUserInfo")
        session.transferUserInfo(stopPayload)
      }
      promise.resolve()
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
    wcLog("[WC-iPhone] resolveActivation: error=\(error?.localizedDescription ?? "nil") state=\(WCSession.default.activationState.rawValue) reachable=\(WCSession.default.isReachable)")
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

  fileprivate func flushPendingStart() {
    guard pendingStart else { return }
    let session = WCSession.default
    guard session.activationState == .activated, session.isReachable else {
      wcLog("[WC-iPhone] flushPendingStart: not reachable yet (reachable=\(session.isReachable)) — will retry on reachability change")
      return
    }
    wcLog("[WC-iPhone] flushPendingStart: sending start cmd")
    session.sendMessage([PayloadKey.command: WatchCommand.start], replyHandler: nil) { error in
      wcLog("[WC-iPhone] flushPendingStart: sendMessage error=\(error.localizedDescription)")
    }
    pendingStart = false
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
    wcLog("[WC-iPhone] didReceiveMessage keys=\(Array(message.keys))")
    if let hr = message[PayloadKey.heartRate] as? NSNumber {
      module?.emitHr(hr.intValue)
    }
    if let state = message[PayloadKey.sessionState] as? String,
       let sentAtMs = message[PayloadKey.sentAtMs] as? NSNumber {
      wcLog("[WC-iPhone] didReceiveMessage sessionState=\(state)")
      module?.emitSessionState(state, sentAtMs: sentAtMs.doubleValue)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    wcLog("[WC-iPhone] didReceiveApplicationContext keys=\(Array(applicationContext.keys))")
    if let state = applicationContext[PayloadKey.sessionState] as? String,
       let sentAtMs = applicationContext[PayloadKey.sentAtMs] as? NSNumber {
      wcLog("[WC-iPhone] didReceiveApplicationContext sessionState=\(state)")
      module?.emitSessionState(state, sentAtMs: sentAtMs.doubleValue)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    wcLog("[WC-iPhone] sessionReachabilityDidChange reachable=\(session.isReachable)")
    module?.emitReachability(session.isReachable)
    if session.isReachable {
      module?.flushPendingStart()
    }
  }
}
