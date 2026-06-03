import WatchKit
import SwiftUI

@main
struct OmniBikeWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchAppDelegate.self) private var appDelegate
    @StateObject private var workoutManager = WorkoutManager.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(workoutManager)
                .onChange(of: scenePhase) { _, newPhase in
                    let name: String
                    switch newPhase {
                    case .active: name = "active"
                    case .inactive: name = "inactive"
                    case .background: name = "background"
                    @unknown default: name = "unknown"
                    }
                    workoutManager.reportAppState(name)
                }
        }
    }
}
