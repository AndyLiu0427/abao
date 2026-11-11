import ActivityKit
import SwiftUI
import UserNotifications
import WebKit

/// Watches the conversation and mirrors "Abao is asking your son" onto the Dynamic Island and Lock Screen.
@MainActor
final class Guardian: NSObject, ObservableObject, WKUIDelegate, WKNavigationDelegate {
    static let base = URL(string: "https://abao.vercel.app")!

    let webView: WKWebView
    private let notifications = NotificationDelegate()
    private var timer: Timer?
    private var busy = false
    private var activity: Activity<AbaoAttributes>?
    private var activityKey = ""
    private var finished = Set<String>()
    private var notified = Set<String>()
    private var background: UIBackgroundTaskIdentifier = .invalid

    override init() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 1.0, green: 0.97, blue: 0.93, alpha: 1)
        super.init()
        webView.uiDelegate = self
        webView.navigationDelegate = self
    }

    func start() {
        guard timer == nil else { return }
        UNUserNotificationCenter.current().delegate = notifications
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        // `-abaoLang en` launch argument opens the English web app (used for the English demo).
        let lang = UserDefaults.standard.string(forKey: "abaoLang")
        webView.load(URLRequest(url: lang == "en" ? URL(string: "/?lang=en", relativeTo: Self.base)! : Self.base))
        timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.tick() }
        }
    }

    /// Keep watching for a short while after the app leaves the screen, so the island can show the family's answer.
    func keepAliveInBackground() {
        guard background == .invalid else { return }
        background = UIApplication.shared.beginBackgroundTask { [weak self] in
            guard let self else { return }
            UIApplication.shared.endBackgroundTask(self.background)
            self.background = .invalid
        }
    }

    // Links that leave Abao (for example "Send with LINE", tel:) open in their own app instead of the web view.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, navigationAction.targetFrame?.isMainFrame != false,
              url.host != Self.base.host, url.scheme != "about", url.scheme != "blob", url.scheme != "data" else {
            return decisionHandler(.allow)
        }
        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    // Camera and microphone prompts from the web app are answered by the system permission dialog alone.
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == Self.base.host ? .grant : .deny)
    }

    private struct Identity: Decodable {
        struct Elder: Decodable { let familyId: String?; let name: String? }
        struct Family: Decodable { let familyId: String?; let memberId: String? }
        let path: String
        let f: String?
        let m: String?
        let elder: Elder?
        let family: Family?
    }

    private static let identityScript = """
    (function(){var g=function(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
    var q=new URLSearchParams(location.search);
    return JSON.stringify({path:location.pathname,f:q.get('f'),m:q.get('m'),elder:g('abao.elder'),family:g('abao.family')})})()
    """

    private func tick() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        guard let json = try? await webView.evaluateJavaScript(Self.identityScript) as? String,
              let id = try? JSONDecoder().decode(Identity.self, from: Data(json.utf8)) else { return }
        if id.path.hasPrefix("/family") {
            if let f = id.f ?? id.family?.familyId, let m = id.m ?? id.family?.memberId { await watchFamily(familyId: f, memberId: m) }
        } else if id.path == "/" {
            if let f = id.f ?? id.elder?.familyId { await watchElder(familyId: f, name: id.elder?.name ?? "媽媽") }
        }
    }

    private func fetch(_ path: String) async -> [String: Any]? {
        guard let url = URL(string: path, relativeTo: Self.base) else { return nil }
        var request = URLRequest(url: url)
        request.timeoutInterval = 8
        guard let (data, _) = try? await URLSession.shared.data(for: request) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    // MARK: Parent's phone

    private func watchElder(familyId: String, name: String) async {
        guard let data = await fetch("/api/chat/history?familyId=\(familyId)"),
              let messages = data["messages"] as? [[String: Any]] else { return }
        let en = ((data["family"] as? [String: Any])?["lang"] as? String) == "en"
        let name = en && name == "媽媽" ? "Mom" : name
        let cards = messages.compactMap { $0["card"] as? [String: Any] }
        guard let index = cards.lastIndex(where: { ($0["type"] as? String) == "waiting" }) else { return }
        let waiting = cards[index]
        let key = (waiting["checkId"] as? String) ?? "check"
        if finished.contains(key) { return }
        let answer = cards[(index + 1)...].first { ["warning", "safe"].contains(($0["type"] as? String) ?? "") }
        if let answer {
            let danger = (answer["type"] as? String) == "warning"
            let state = AbaoAttributes.ContentState(
                phase: danger ? "danger" : "safe",
                title: (answer["title"] as? String) ?? (en ? (danger ? "This is a scam" : "All clear") : (danger ? "這是詐騙" : "確認沒問題")),
                detail: en ? (danger ? "Do not send money or reply to them" : "Your family confirmed it") : (danger ? "千萬不要匯款，也不要再回對方" : "家人已經確認了"),
                en: en
            )
            await show(key: key, elderName: name, state: state)
            notify(id: "answer-\(key)", title: (en ? "Abao: " : "阿寶：") + state.title, body: state.detail)
            await finish(key: key, state: state)
        } else {
            await show(key: key, elderName: name, state: .init(
                phase: "asking",
                title: (waiting["title"] as? String) ?? (en ? "Asking your family…" : "正在問家人…"),
                detail: en ? "Don't send money until they answer" : "回覆之前，先不要匯款",
                en: en
            ))
        }
    }

    // MARK: Family member's phone

    private func watchFamily(familyId: String, memberId: String) async {
        guard let data = await fetch("/api/family/pending?familyId=\(familyId)&memberId=\(memberId)") else { return }
        let pending = (data["pending"] as? [[String: Any]]) ?? []
        let en = ((data["family"] as? [String: Any])?["lang"] as? String) == "en"
        let elder = ((data["family"] as? [String: Any])?["elderName"] as? String) ?? (en ? "Mom" : "媽媽")
        guard let check = pending.first, let key = check["id"] as? String else {
            if !activityKey.isEmpty, let activity {
                let done = en
                    ? AbaoAttributes.ContentState(phase: "safe", title: "Answered \(elder)", detail: "Abao told \(elder) your answer", en: true)
                    : AbaoAttributes.ContentState(phase: "safe", title: "已回覆\(elder)", detail: "阿寶已經把你的回答告訴\(elder)")
                await activity.end(.init(state: done, staleDate: nil), dismissalPolicy: .after(.now + 6))
                self.activity = nil
                activityKey = ""
            }
            return
        }
        let question = (check["question"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? (en ? "\(elder) got a message claiming to be you. Is it you?" : "\(elder)收到自稱是你的訊息，是你嗎？")
        let state = AbaoAttributes.ContentState(phase: "alert", title: en ? "\(elder) needs you" : "\(elder)需要你確認", detail: question, en: en)
        await show(key: key, elderName: elder, state: state)
        notify(id: "ask-\(key)", title: (en ? "Abao: " : "阿寶：") + state.title, body: question)
    }

    // MARK: Live Activity and notifications

    private func show(key: String, elderName: String, state: AbaoAttributes.ContentState) async {
        let content = ActivityContent(state: state, staleDate: nil)
        if activityKey == key, let activity {
            if activity.content.state != state { await activity.update(content) }
            return
        }
        if let activity { await activity.end(nil, dismissalPolicy: .immediate) }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        activity = try? Activity.request(attributes: AbaoAttributes(elderName: elderName), content: content, pushType: nil)
        activityKey = key
    }

    private func finish(key: String, state: AbaoAttributes.ContentState) async {
        finished.insert(key)
        guard let activity else { return }
        self.activity = nil
        activityKey = ""
        // Ending removes it from the Dynamic Island, so let the answer stay there for a moment first.
        try? await Task.sleep(for: .seconds(30))
        await activity.end(.init(state: state, staleDate: nil), dismissalPolicy: .after(.now + 15))
    }

    private func notify(id: String, title: String, body: String) {
        guard !notified.contains(id) else { return }
        notified.insert(id)
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.interruptionLevel = .timeSensitive
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: nil))
    }
}
