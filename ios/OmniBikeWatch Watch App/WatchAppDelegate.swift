import HealthKit
import WatchKit

final class WatchAppDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        wcLog("[WC-Watch] applicationDidFinishLaunching")
        WorkoutManager.shared.requestAuthorization()
    }

    // Called when the paired iPhone invokes `HKHealthStore.startWatchApp(with:)`.
    // watchOS wakes / launches this app in the background and delivers the
    // configuration here.
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        wcLog("[WC-Watch] WKApplicationDelegate.handle(_:) fired — iPhone triggered startWatchApp")
        WorkoutManager.shared.requestAuthorization(starting: workoutConfiguration)
    }
}
