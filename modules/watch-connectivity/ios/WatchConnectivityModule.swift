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
  // Ride-control request sent FROM the Watch (the wrist acting as a remote):
  // "pause" | "resume" | "end". Distinct from `command`, which flows iPhone→Watch.
  static let watchControl = "watchControl"
}

fileprivate enum WatchCommand {
  static let start = "start"
  static let stop = "stop"
  static let pause = "pause"
  static let resume = "resume"
}

public class WatchConnectivityModule: Module {
  // Single isolation domain for the module's mutable state. activationPromises,
  // pendingStart, mirroredSession and lastEmittedSampleSentAtMs are all read/written
  // from several queues (the module call queue, the startWatchApp completion, the
  // HealthKit mirroring handler, and WCSession/HKWorkoutSession delegate callbacks),
  // so every access is funnelled through this serial queue.
  private let stateQueue = DispatchQueue(label: "com.omnibike.watchconnectivity.state")
  fileprivate var activationPromises: [Promise] = []
  private let healthStore = HKHealthStore()
  private lazy var sessionDelegate: SessionDelegateProxy = SessionDelegateProxy(module: self)
  private var pendingStart: Bool = false
  private var mirroredSession: HKWorkoutSession?
  // Monotonic high-water mark for emitted HR/kcal sample timestamps. The Watch fans the
  // same ~1 Hz payload across three transports (sendMessage, mirrored session,
  // applicationContext), each stamped with the same sentAtMs; this de-dups them so a
  // sample reaches JS exactly once. Guarded by stateQueue.
  //
  // Correctness rests on sentAtMs being monotonic wall-clock (`Date().timeIntervalSince1970`
  // on the Watch): each ride's first sample is newer than the previous ride's last, so it is
  // deliberately NOT reset between sessions. A backward clock adjustment between samples (NTP
  // / manual) would drop real samples until the clock catches up — acceptable (rare, and HR
  // staleness self-heals via the 15 s freshness gate). If that ever bites, reset this to nil
  // in clearMirroredWorkoutSession() rather than switching to a relative timestamp.
  private var lastEmittedSampleSentAtMs: Double?

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivity")

    Events("onWatchHr", "onWatchActiveKcal", "onReachabilityChange", "onWatchSessionState", "onWatchCompanionStateChange", "onWatchAppState", "onWatchControlRequest")

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
      // Register the delegate unconditionally. When the session is already
      // `.activated` at the first activate() call, the early return below used to
      // skip this — so `sessionReachabilityDidChange` / `sessionWatchStateDidChange`
      // never fired and the iPhone never saw the Watch app open/close (status stuck).
      // Setting the delegate on an already-activated session is safe and idempotent.
      session.delegate = self.sessionDelegate
      wcLog("[WC-iPhone] activate: state=\(session.activationState.rawValue) paired=\(session.isPaired) installed=\(session.isWatchAppInstalled) reachable=\(session.isReachable)")
      if session.activationState == .activated {
        self.emitReachability(session.isReachable)
        self.emitCompanionState(session)
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
      self.setPendingStart(true)
      self.healthStore.startWatchApp(with: configuration) { success, error in
        if let error {
          wcLog("[WC-iPhone] startWatchApp: FAILED with error: \(error.localizedDescription)")
          self.setPendingStart(false)
          promise.reject("ERR_START_WATCH_APP_FAILED", error.localizedDescription)
          return
        }
        guard success else {
          wcLog("[WC-iPhone] startWatchApp: FAILED success=false")
          self.setPendingStart(false)
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
      if self.getPendingStart() {
        wcLog("[WC-iPhone] endMirroredWorkout: clearing pendingStart")
        self.setPendingStart(false)
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

    // Forwards a pause to the Watch. The Watch owns the HKWorkoutSession, so only it
    // can pause it — pausing stops its system workout timer and HR collection.
    AsyncFunction("pauseMirroredWorkout") { (promise: Promise) in
      wcLog("[WC-iPhone] pauseMirroredWorkout() called")
      self.sendCommandToWatch(WatchCommand.pause, label: "pauseMirroredWorkout")
      promise.resolve()
    }

    AsyncFunction("resumeMirroredWorkout") { (promise: Promise) in
      wcLog("[WC-iPhone] resumeMirroredWorkout() called")
      self.sendCommandToWatch(WatchCommand.resume, label: "resumeMirroredWorkout")
      promise.resolve()
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
      emitCompanionState(WCSession.default)
      promises.forEach { $0.resolve() }
    }
  }

  // ── stateQueue-guarded accessors ────────────────────────────────────────────

  private func setPendingStart(_ value: Bool) {
    stateQueue.sync { pendingStart = value }
  }

  private func getPendingStart() -> Bool {
    stateQueue.sync { pendingStart }
  }

  // De-dup the ~1 Hz HR/kcal fan-out. The Watch sends an identical payload over three
  // transports, each carrying the same sentAtMs; emit a given sentAtMs once and ignore
  // any that is not strictly newer than the last emitted (a duplicate from another
  // transport, or a stale applicationContext coalesce). A missing sentAtMs can't be
  // de-duped, so it passes through.
  fileprivate func shouldEmitSample(sentAtMs: Double?) -> Bool {
    guard let sentAtMs else { return true }
    return stateQueue.sync {
      if let last = lastEmittedSampleSentAtMs, sentAtMs <= last {
        return false
      }
      lastEmittedSampleSentAtMs = sentAtMs
      return true
    }
  }

  fileprivate func flushPendingStart() {
    guard getPendingStart() else { return }
    let session = WCSession.default
    guard session.activationState == .activated, session.isReachable else {
      wcLog("[WC-iPhone] flushPendingStart: not reachable yet (reachable=\(session.isReachable)) — will retry on reachability change")
      return
    }
    wcLog("[WC-iPhone] flushPendingStart: sending start cmd")
    session.sendMessage([PayloadKey.command: WatchCommand.start], replyHandler: nil) { error in
      wcLog("[WC-iPhone] flushPendingStart: sendMessage error=\(error.localizedDescription)")
    }
    setPendingStart(false)
  }

  // Sends a lifecycle command (pause/resume) to the Watch. Live via sendMessage when
  // reachable; otherwise queued FIFO via transferUserInfo so it still arrives when the
  // Watch next wakes — same delivery contract as the stop command.
  fileprivate func sendCommandToWatch(_ command: String, label: String) {
    let session = WCSession.default
    guard session.activationState == .activated else {
      wcLog("[WC-iPhone] \(label): dropping — WC not activated")
      return
    }
    let payload = [PayloadKey.command: command]
    if session.isReachable {
      wcLog("[WC-iPhone] \(label): sending via sendMessage")
      session.sendMessage(payload, replyHandler: nil)
    } else {
      wcLog("[WC-iPhone] \(label): unreachable — queuing via transferUserInfo")
      session.transferUserInfo(payload)
    }
  }

  fileprivate func emitHr(_ hr: Int) {
    sendEvent("onWatchHr", ["hr": hr])
  }

  fileprivate func emitActiveKcal(_ kcal: Double) {
    sendEvent("onWatchActiveKcal", ["activeKcal": kcal])
  }

  fileprivate func emitReachability(_ reachable: Bool) {
    let session = WCSession.default
    sendEvent("onReachabilityChange", [
      "reachable": reachable,
      "activationState": session.activationState.rawValue,
      "paired": session.isPaired,
      "installed": session.isWatchAppInstalled,
    ])
  }

  // Stable companion presence — paired + Watch app installed — independent of
  // `isReachable`, which drops whenever the Watch screen dims. This drives the
  // iPhone's idle ⇄ unavailable status; reachability must not.
  fileprivate func emitCompanionState(_ session: WCSession) {
    let available = session.isPaired && session.isWatchAppInstalled
    wcLog("[WC-iPhone] emitCompanionState available=\(available) paired=\(session.isPaired) installed=\(session.isWatchAppInstalled) activationState=\(session.activationState.rawValue) reachable=\(session.isReachable)")
    sendEvent("onWatchCompanionStateChange", [
      "available": available,
      "paired": session.isPaired,
      "installed": session.isWatchAppInstalled,
      "activationState": session.activationState.rawValue,
      "reachable": session.isReachable,
    ])
  }

  fileprivate func emitSessionState(_ state: String, sentAtMs: Double) {
    sendEvent("onWatchSessionState", ["state": state, "sentAtMs": sentAtMs])
  }

  fileprivate func emitWatchAppState(_ state: String) {
    wcLog("[WC-iPhone] emitWatchAppState state=\(state)")
    sendEvent("onWatchAppState", ["state": state])
  }

  // A ride-control request initiated on the Watch. The iPhone owns the ride, so JS
  // runs the same training action a phone tap would (which in turn pauses/ends the
  // Watch's own session via the existing iPhone→Watch command path).
  fileprivate func emitWatchControlRequest(_ action: String, sentAtMs: Double?) {
    wcLog("[WC-iPhone] emitWatchControlRequest action=\(action)")
    var payload: [String: Any] = ["action": action]
    if let sentAtMs {
      payload[PayloadKey.sentAtMs] = sentAtMs
    }
    sendEvent("onWatchControlRequest", payload)
  }

  fileprivate func attachMirroredWorkoutSession(_ session: HKWorkoutSession) {
    wcLog("[WC-iPhone] attachMirroredWorkoutSession state=\(session.state.rawValue) type=\(session.type.rawValue)")

    session.delegate = sessionDelegate

    // Swap the stored session atomically and detach the previous one outside the lock.
    let previous: HKWorkoutSession? = stateQueue.sync {
      let old = mirroredSession
      mirroredSession = session
      return old
    }
    if let previous, previous !== session {
      previous.delegate = nil
    }

    if session.state == .running {
      emitSessionState(PayloadKeySessionState.started, sentAtMs: Date().timeIntervalSince1970 * 1000)
    }
  }

  fileprivate func clearMirroredWorkoutSession() {
    let previous: HKWorkoutSession? = stateQueue.sync {
      let old = mirroredSession
      mirroredSession = nil
      return old
    }
    previous?.delegate = nil
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
  // Same wall-clock stamp the Watch puts on every transport's copy of a sample; used
  // to de-dup the fan-out across sendMessage / mirrored session / applicationContext.
  let sentAtMs: Double?
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
    emitSampleIfNew(
      hr: message[PayloadKey.heartRate] as? NSNumber,
      kcal: message[PayloadKey.activeKcal] as? NSNumber,
      sentAtMs: (message[PayloadKey.sentAtMs] as? NSNumber)?.doubleValue,
      source: "message"
    )
    if let state = message[PayloadKey.sessionState] as? String,
       let sentAtMs = message[PayloadKey.sentAtMs] as? NSNumber {
      wcLog("[WC-iPhone] didReceiveMessage sessionState=\(state)")
      module?.emitSessionState(state, sentAtMs: sentAtMs.doubleValue)
    }
    if let watchAppState = message["watchAppState"] as? String {
      module?.emitWatchAppState(watchAppState)
    }
    if let control = message[PayloadKey.watchControl] as? String {
      wcLog("[WC-iPhone] didReceiveMessage watchControl=\(control)")
      let sentAtMs = (message[PayloadKey.sentAtMs] as? NSNumber)?.doubleValue
      module?.emitWatchControlRequest(control, sentAtMs: sentAtMs)
    }
  }

  // Control requests queued by the Watch via `transferUserInfo` when it was unreachable
  // (e.g. the iPhone app was backgrounded) arrive here on the next wake — FIFO, guaranteed.
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    wcLog("[WC-iPhone] didReceiveUserInfo keys=\(Array(userInfo.keys))")
    if let control = userInfo[PayloadKey.watchControl] as? String {
      wcLog("[WC-iPhone] didReceiveUserInfo watchControl=\(control)")
      let sentAtMs = (userInfo[PayloadKey.sentAtMs] as? NSNumber)?.doubleValue
      module?.emitWatchControlRequest(control, sentAtMs: sentAtMs)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    wcLog("[WC-iPhone] didReceiveApplicationContext keys=\(Array(applicationContext.keys))")
    emitSampleIfNew(
      hr: applicationContext[PayloadKey.heartRate] as? NSNumber,
      kcal: applicationContext[PayloadKey.activeKcal] as? NSNumber,
      sentAtMs: (applicationContext[PayloadKey.sentAtMs] as? NSNumber)?.doubleValue,
      source: "applicationContext"
    )
    if let state = applicationContext[PayloadKey.sessionState] as? String,
       let sentAtMs = applicationContext[PayloadKey.sentAtMs] as? NSNumber {
      wcLog("[WC-iPhone] didReceiveApplicationContext sessionState=\(state)")
      module?.emitSessionState(state, sentAtMs: sentAtMs.doubleValue)
    }
    if let watchAppState = applicationContext["watchAppState"] as? String {
      module?.emitWatchAppState(watchAppState)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    wcLog("[WC-iPhone] sessionReachabilityDidChange reachable=\(session.isReachable)")
    module?.emitReachability(session.isReachable)
    if session.isReachable {
      module?.flushPendingStart()
    }
  }

  // Fires when the Watch is paired/unpaired or the companion app is
  // installed/removed — the events that actually change availability.
  func sessionWatchStateDidChange(_ session: WCSession) {
    wcLog("[WC-iPhone] sessionWatchStateDidChange paired=\(session.isPaired) installed=\(session.isWatchAppInstalled)")
    module?.emitCompanionState(session)
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
      guard module?.shouldEmitSample(sentAtMs: payload.sentAtMs) ?? false else {
        wcLog("[WC-iPhone] mirrored sample sentAtMs=\(payload.sentAtMs.map { String($0) } ?? "nil") — duplicate, skipping")
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

  // De-dup gate shared by the sendMessage and applicationContext receive paths: emit a
  // sample only when its sentAtMs is newer than the last emitted (across all transports).
  // A payload with neither hr nor kcal is not a sample and is ignored here.
  private func emitSampleIfNew(hr: NSNumber?, kcal: NSNumber?, sentAtMs: Double?, source: String) {
    guard hr != nil || kcal != nil else { return }
    guard module?.shouldEmitSample(sentAtMs: sentAtMs) ?? false else {
      wcLog("[WC-iPhone] \(source) sample sentAtMs=\(sentAtMs.map { String($0) } ?? "nil") — duplicate, skipping")
      return
    }
    if let hr {
      module?.emitHr(hr.intValue)
    }
    if let kcal {
      module?.emitActiveKcal(kcal.doubleValue)
    }
  }
}
