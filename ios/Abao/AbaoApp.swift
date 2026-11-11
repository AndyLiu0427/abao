import SwiftUI
import UserNotifications
import WebKit

@main
struct AbaoApp: App {
    @StateObject private var guardian = Guardian()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            WebView(webView: guardian.webView)
                .ignoresSafeArea()
                .background(Color(red: 1.0, green: 0.97, blue: 0.93))
                .onAppear { guardian.start() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .background { guardian.keepAliveInBackground() }
                }
        }
    }
}

/// The app's screens are the Abao web app; the native shell adds the Dynamic Island, Lock Screen and notifications.
struct WebView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}
