import SwiftUI

struct ContentView: View {
    @EnvironmentObject var workoutManager: WorkoutManager

    private var statusColor: Color {
        switch workoutManager.displayState {
        case .idle:
            return .secondary
        case .starting:
            return .yellow
        case .active:
            return .green
        case .ending:
            return .orange
        case .ended:
            return .blue
        case .failed:
            return .red
        }
    }

    private var statusTitle: String {
        switch workoutManager.displayState {
        case .idle:
            return "Idle"
        case .starting:
            return "Starting"
        case .active:
            return "Workout In Progress"
        case .ending:
            return "Ending"
        case .ended:
            return "Workout Finished"
        case .failed:
            return "Start Failed"
        }
    }

    private var statusCaption: String {
        switch workoutManager.displayState {
        case .idle:
            return "Waiting for the next ride"
        case .starting:
            return "Launching workout session"
        case .active:
            return "Live heart rate"
        case .ending:
            return "Closing workout session"
        case .ended:
            return "Training completed"
        case .failed:
            return "Open Omni Bike on the watch and try again"
        }
    }

    private var shouldShowHeartRate: Bool {
        workoutManager.displayState == .active
    }

    var body: some View {
        VStack(spacing: 10) {
            Circle()
                .fill(statusColor.opacity(0.18))
                .frame(width: 54, height: 54)
                .overlay(
                    Circle()
                        .stroke(statusColor.opacity(0.4), lineWidth: 1.5)
                )

            Text(statusTitle)
                .font(.headline)
                .multilineTextAlignment(.center)
                .foregroundColor(statusColor)

            if shouldShowHeartRate {
                Text("\(workoutManager.heartRate)")
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundColor(.red)
                Text("bpm")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                Text(statusCaption)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(16)
    }
}
