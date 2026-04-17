import SwiftUI

struct ContentView: View {
    @EnvironmentObject var workoutManager: WorkoutManager

    private var statusColor: Color {
        switch workoutManager.displayState {
        case .idle:
            return .secondary
        case .inProgress:
            return .green
        }
    }

    private var statusTitle: String {
        switch workoutManager.displayState {
        case .idle:
            return "Idle"
        case .inProgress:
            return "Workout In Progress"
        }
    }

    private var statusCaption: String {
        switch workoutManager.displayState {
        case .idle:
            return "Waiting for the next ride"
        case .inProgress:
            return "Live heart rate"
        }
    }

    private var shouldShowHeartRate: Bool {
        workoutManager.displayState == .inProgress
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
