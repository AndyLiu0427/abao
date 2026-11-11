import ActivityKit
import Foundation

/// What the Dynamic Island and Lock Screen show while Abao is checking with family.
struct AbaoAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// asking: waiting for family. danger: family said it was not them. safe: confirmed. alert: family member is being asked.
        var phase: String
        var title: String
        var detail: String
        /// English labels on the island for families using the English web app.
        var en: Bool = false
    }
    var elderName: String
}
