import SwiftUI

struct ContentView: View {
    @EnvironmentObject var workoutManager: WorkoutManager

    var body: some View {
        VStack(spacing: 12) {
            Text(workoutManager.isStreaming ? "Streaming" : "Idle")
                .font(.headline)
                .foregroundColor(workoutManager.isStreaming ? .green : .secondary)

            if workoutManager.isStreaming {
                Text("\(workoutManager.heartRate)")
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundColor(.red)
                Text("bpm")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }
}
