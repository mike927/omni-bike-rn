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
  static let activeKcal = "activeKcal"
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
  fileprivate var activationPromises: [Promise] = []
  private let healthStore = HKHealthStore()
  private lazy var sessionDelegate: SessionDelegateProxy = SessionDelegateProxy(module: self)
  fileprivate var pendingStart: Bool = false
  private var mirroredSession: HKWorkoutSession?

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivity")

    Events("onWatchHr", "onWatchActiveKcal", "onReachabilityChange", "onWatchSessionState")

    // Per WWDC23 session 10023: register the mirroring handler on every app
    // launch (foreground or background) so HealthKit can hand us the primary
    // session that the Watch created. Without this, `startMirroringToCompanionDevice`
    // on the Watch has nothing to mirror to.
    OnCreate {
      wcLog("[WC-iPhone] OnCreate: registering workoutSessionMirroringStartHandler")
      self.healthStore.workoutSessionMirroringStartHandler = { mirroredSession in
        wcLog("[WC-iPhone] workoutSessionMirroringStartHandler fired state=\(mirroredSession.state.rawValue) type=\(mirroredSession.type.rawValue)")
        self.attachMirroredWorkoutSession(mirroredSession)
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
      var shouldActivate = false
      self.stateQueue.sync {
        shouldActivate = self.activationPromises.isEmpty
        self.activationPromises.append(promise)
      }
      if !shouldActivate {
        wcLog("[WC-iPhone] activate: joining in-flight activation")
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
      // Clear any queued start. Without this, a user flow of "tap Start on
      // iPhone while Watch is unreachable → cancel before Watch wakes" leaks a
      // stale start cmd the next time reachability flips true, auto-launching a
      // workout the user never asked for.
      if self.pendingStart {
        wcLog("[WC-iPhone] endMirroredWorkout: clearing pendingStart")
        self.pendingStart = false
      }
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
    var promises: [Promise] = []
    stateQueue.sync {
      promises = activationPromises
      activationPromises = []
    }
    if let err = error {
      promises.forEach { $0.reject("ERR_ACTIVATION_FAILED", err.localizedDescription) }
    } else {
      emitReachability(WCSession.default.isReachable)
      promises.forEach { $0.resolve() }
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

  fileprivate func emitActiveKcal(_ kcal: Double) {
    sendEvent("onWatchActiveKcal", ["activeKcal": kcal])
  }

  fileprivate func emitReachability(_ reachable: Bool) {
    sendEvent("onReachabilityChange", ["reachable": reachable])
  }

  fileprivate func emitSessionState(_ state: String, sentAtMs: Double) {
    sendEvent("onWatchSessionState", ["state": state, "sentAtMs": sentAtMs])
  }

  fileprivate func attachMirroredWorkoutSession(_ session: HKWorkoutSession) {
    clearMirroredWorkoutSession()
    wcLog("[WC-iPhone] attachMirroredWorkoutSession state=\(session.state.rawValue) type=\(session.type.rawValue)")

    session.delegate = sessionDelegate

    mirroredSession = session

    if session.state == .running {
      emitSessionState(PayloadKeySessionState.started, sentAtMs: Date().timeIntervalSince1970 * 1000)
    }
  }

  fileprivate func clearMirroredWorkoutSession() {
    mirroredSession?.delegate = nil
    mirroredSession = nil
  }
}

fileprivate enum PayloadKeySessionState {
  static let started = "started"
  static let ended = "ended"
  static let failed = "failed"
}

fileprivate struct MirroredWorkoutPayload: Decodable {
  let hr: Int?
  let activeKcal: Double?
}

private class SessionDelegateProxy: NSObject, WCSessionDelegate, HKWorkoutSessionDelegate {
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
    if let kcal = message[PayloadKey.activeKcal] as? NSNumber {
      module?.emitActiveKcal(kcal.doubleValue)
    }
    if let state = message[PayloadKey.sessionState] as? String,
       let sentAtMs = message[PayloadKey.sentAtMs] as? NSNumber {
      wcLog("[WC-iPhone] didReceiveMessage sessionState=\(state)")
      module?.emitSessionState(state, sentAtMs: sentAtMs.doubleValue)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    wcLog("[WC-iPhone] didReceiveApplicationContext keys=\(Array(applicationContext.keys))")
    if let hr = applicationContext[PayloadKey.heartRate] as? NSNumber {
      module?.emitHr(hr.intValue)
    }
    if let kcal = applicationContext[PayloadKey.activeKcal] as? NSNumber {
      module?.emitActiveKcal(kcal.doubleValue)
    }
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

  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    wcLog("[WC-iPhone] mirrored workoutSession didChangeTo \(toState.rawValue) from \(fromState.rawValue)")
    switch toState {
    case .running:
      module?.emitSessionState(PayloadKeySessionState.started, sentAtMs: date.timeIntervalSince1970 * 1000)
    case .ended:
      module?.emitSessionState(PayloadKeySessionState.ended, sentAtMs: date.timeIntervalSince1970 * 1000)
      module?.clearMirroredWorkoutSession()
    default:
      break
    }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    wcLog("[WC-iPhone] mirrored workoutSession didFailWithError: \(error.localizedDescription)")
    module?.emitSessionState(PayloadKeySessionState.failed, sentAtMs: Date().timeIntervalSince1970 * 1000)
    module?.clearMirroredWorkoutSession()
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didReceiveDataFromRemoteWorkoutSession data: [Data]) {
    for entry in data {
      guard let payload = try? JSONDecoder().decode(MirroredWorkoutPayload.self, from: entry) else {
        continue
      }
      if let hr = payload.hr {
        wcLog("[WC-iPhone] mirrored workoutSession didReceiveDataFromRemoteWorkoutSession hr=\(hr)")
        module?.emitHr(hr)
      }
      if let kcal = payload.activeKcal {
        module?.emitActiveKcal(kcal)
      }
    }
  }
}
