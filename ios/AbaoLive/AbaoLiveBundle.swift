import ActivityKit
import SwiftUI
import WidgetKit

@main
struct AbaoLiveBundle: WidgetBundle {
    var body: some Widget {
        AbaoLiveActivity()
    }
}

private func emoji(_ phase: String) -> String {
    switch phase {
    case "danger": return "🚫"
    case "safe": return "✅"
    case "alert": return "🚨"
    default: return "🛡️"
    }
}

private func short(_ phase: String) -> String {
    switch phase {
    case "danger": return "別匯款"
    case "safe": return "安全"
    case "alert": return "請確認"
    default: return "詢問中"
    }
}

private func tint(_ phase: String) -> Color {
    switch phase {
    case "danger", "alert": return .red
    case "safe": return .green
    default: return .orange
    }
}

struct AbaoLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AbaoAttributes.self) { context in
            // Lock Screen and notification banner
            HStack(spacing: 14) {
                Text(emoji(context.state.phase)).font(.system(size: 40))
                VStack(alignment: .leading, spacing: 2) {
                    Text("阿寶 Abao").font(.caption).bold().opacity(0.85)
                    Text(context.state.title).font(.title3).bold().lineLimit(2)
                    Text(context.state.detail).font(.subheadline).opacity(0.9).lineLimit(2)
                }
                Spacer(minLength: 0)
                if context.state.phase == "asking" {
                    ProgressView().tint(.white)
                }
            }
            .padding(16)
            .foregroundStyle(.white)
            .activityBackgroundTint(tint(context.state.phase))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(emoji(context.state.phase)).font(.system(size: 36))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.phase == "asking" {
                        ProgressView().tint(.orange)
                    } else {
                        Text(short(context.state.phase)).font(.headline).foregroundStyle(tint(context.state.phase))
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title).font(.headline).lineLimit(2).multilineTextAlignment(.center)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.detail).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
            } compactLeading: {
                Text(emoji(context.state.phase))
            } compactTrailing: {
                Text(short(context.state.phase)).font(.caption).bold().foregroundStyle(tint(context.state.phase))
            } minimal: {
                Text(emoji(context.state.phase))
            }
            .keylineTint(tint(context.state.phase))
        }
    }
}
