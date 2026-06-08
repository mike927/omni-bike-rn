import SwiftUI

// MARK: - Calm Noir palette (watch)
// Mirrors the app token sheet (DESIGN.md / src/ui/theme.ts). The screen uses OLED black
// rather than #0b0e13 — it is cheaper to drive in the Always-On (luminance-reduced) state.

private extension Color {
    init(noir hex: UInt) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: 1
        )
    }
}

private enum Noir {
    static let bg = Color.black
    static let ink = Color(noir: 0xeef1f6)
    static let ink2 = Color(noir: 0x9aa3b2)
    static let ink3 = Color(noir: 0x828b9c) // lightened from 0x6b7384 for WCAG AA on OLED black
    static let mint = Color(noir: 0x10b5a4)
    static let mintSoft = Color(noir: 0x4fd8c8)
    static let amber = Color(noir: 0xf5a524)
    static let amberSoft = Color(noir: 0xf7c46b)
    static let danger = Color(noir: 0xef4b5c)
    static let dangerSoft = Color(noir: 0xff8a93)
}

// MARK: - Honest status vocabulary (mirrors the app's DeviceStatus pill)

private enum RideStatus {
    case ready, connecting, noSignal, paused

    var label: String {
        switch self {
        case .ready: return "Ready"
        case .connecting: return "Connecting…"
        case .noSignal: return "No signal"
        case .paused: return "Paused"
        }
    }

    var accent: Color {
        switch self {
        case .ready: return Noir.mintSoft
        case .connecting: return Noir.amberSoft
        case .noSignal: return Noir.dangerSoft
        case .paused: return Noir.ink3
        }
    }

    var dot: Color {
        switch self {
        case .ready: return Noir.mint
        case .connecting: return Noir.amber
        case .noSignal: return Noir.danger
        case .paused: return Color(noir: 0x4a5260)
        }
    }

    var tint: Color {
        switch self {
        case .ready: return Noir.mint.opacity(0.14)
        case .connecting: return Noir.amber.opacity(0.14)
        case .noSignal: return Noir.danger.opacity(0.16)
        case .paused: return Color.white.opacity(0.06)
        }
    }
}

// MARK: - Root

struct ContentView: View {
    @EnvironmentObject var workoutManager: WorkoutManager
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced

    // The Watch generates HR locally at ~1 Hz, so a short stall window is honest here.
    private let hrNoSignalSeconds: TimeInterval = 8

    private var status: RideStatus {
        switch workoutManager.displayState {
        case .paused:
            return .paused
        case .inProgress:
            guard let last = workoutManager.lastHrAt else { return .connecting }
            return Date().timeIntervalSince(last) <= hrNoSignalSeconds ? .ready : .noSignal
        case .idle:
            return .ready
        }
    }

    private var isResting: Bool { workoutManager.displayState == .idle }

    var body: some View {
        Group {
            if isResting {
                IdleView()
            } else if isLuminanceReduced {
                AlwaysOnView(status: status,
                             heartRate: workoutManager.heartRate,
                             elapsed: workoutManager.elapsedSeconds)
            } else {
                ActiveView(status: status,
                           paused: workoutManager.displayState == .paused,
                           heartRate: workoutManager.heartRate,
                           elapsed: workoutManager.elapsedSeconds,
                           onPause: { workoutManager.requestControl(.pause) },
                           onResume: { workoutManager.requestControl(.resume) },
                           onEnd: { workoutManager.requestControl(.end) })
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Noir.bg.ignoresSafeArea())
    }
}

// MARK: - Active / Paused — "Big Number"

private struct ActiveView: View {
    let status: RideStatus
    let paused: Bool
    let heartRate: Int
    let elapsed: Int
    let onPause: () -> Void
    let onResume: () -> Void
    let onEnd: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            StatusPill(status: status)
                .padding(.top, 2)

            Spacer(minLength: 4)

            HeartRateHero(heartRate: heartRate)

            Spacer(minLength: 6)

            ElapsedRow(elapsed: elapsed)
                .padding(.bottom, 10)

            HStack(spacing: 8) {
                if paused {
                    ControlButton(title: "Resume", kind: .resume, action: onResume)
                } else {
                    ControlButton(title: "Pause", kind: .pause, action: onPause)
                }
                ControlButton(title: "End", kind: .end, action: onEnd)
            }
        }
        .padding(.horizontal, 6)
    }
}

// MARK: - Always-On (dimmed) — HR + time only, no controls

private struct AlwaysOnView: View {
    let status: RideStatus
    let heartRate: Int
    let elapsed: Int

    var body: some View {
        VStack(spacing: 6) {
            Text(status.label.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .tracking(0.5)
                .foregroundColor(Noir.ink3)
            HeartRateHero(heartRate: heartRate, dimmed: true)
            ElapsedRow(elapsed: elapsed)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Idle — start is on the phone

private struct IdleView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "figure.indoor.cycle")
                .font(.system(size: 34, weight: .semibold))
                .foregroundColor(Noir.mint)
            Text("Ready to ride")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(Noir.ink)
            Text("Start your ride on iPhone")
                .font(.system(size: 13))
                .multilineTextAlignment(.center)
                .foregroundColor(Noir.ink2)
        }
        .padding(.horizontal, 12)
    }
}

// MARK: - Pieces

private struct StatusPill: View {
    let status: RideStatus
    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(status.dot)
                .frame(width: 7, height: 7)
            Text(status.label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(status.accent)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 5)
        .background(Capsule().fill(status.tint))
    }
}

private struct HeartRateHero: View {
    let heartRate: Int
    var dimmed: Bool = false

    private var display: String { heartRate > 0 ? "\(heartRate)" : "--" }

    var body: some View {
        VStack(spacing: 2) {
            if !dimmed {
                HStack(spacing: 5) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 12))
                        .foregroundColor(Noir.mint)
                    Text("HEART RATE")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.5)
                        .foregroundColor(Noir.ink3)
                }
            }
            Text(display)
                .font(.system(size: dimmed ? 56 : 68, weight: .bold, design: .rounded))
                .foregroundColor(heartRate > 0 ? Noir.mintSoft : Noir.ink3)
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            if !dimmed {
                Text("BPM")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.5)
                    .foregroundColor(Noir.ink2)
            }
        }
    }
}

private struct ElapsedRow: View {
    let elapsed: Int
    var body: some View {
        HStack(spacing: 7) {
            Text("ELAPSED")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundColor(Noir.ink3)
            Text(formatElapsed(elapsed))
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(Noir.ink)
                .monospacedDigit()
        }
    }
}

private struct ControlButton: View {
    enum Kind { case pause, resume, end }
    let title: String
    let kind: Kind
    let action: () -> Void

    private var foreground: Color {
        switch kind {
        case .pause: return Noir.amberSoft
        case .resume: return Color(noir: 0x04140f)
        case .end: return Noir.dangerSoft
        }
    }
    private var background: Color {
        switch kind {
        case .pause: return Noir.amber.opacity(0.16)
        case .resume: return Noir.mint
        case .end: return Noir.danger.opacity(0.16)
        }
    }
    private var symbol: String {
        switch kind {
        case .pause: return "pause.fill"
        case .resume: return "play.fill"
        case .end: return "stop.fill"
        }
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: symbol).font(.system(size: 13, weight: .bold))
                Text(title).font(.system(size: 15, weight: .bold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .foregroundColor(foreground)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(background))
        }
        .buttonStyle(.plain)
    }
}

private func formatElapsed(_ seconds: Int) -> String {
    let safe = max(0, seconds)
    let h = safe / 3600
    let m = (safe % 3600) / 60
    let s = safe % 60
    if h > 0 {
        return String(format: "%d:%02d:%02d", h, m, s)
    }
    return String(format: "%d:%02d", m, s)
}
