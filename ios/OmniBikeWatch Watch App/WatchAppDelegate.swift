import HealthKit
import WatchKit

final class WatchAppDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        wcLog("[WC-Watch] applicationDidFinishLaunching")
        // Extend the Watch app's frontmost window from ~1 min to ~8 min while
        // no workout session is running. During an active HKWorkoutSession the
        // app already stays frontmost indefinitely, so this only matters for
        // pre-start and post-end states where the user is still interacting.
        // Property still lives on WKExtension even though most other Watch app
        // lifecycle moved to WKApplication.
        WKExtension.shared().isFrontmostTimeoutExtended = true
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
