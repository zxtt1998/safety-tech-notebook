import SwiftUI
import WebKit

final class NotebookWebModel: NSObject, ObservableObject {
    enum Source {
        case remote
        case local
    }

    @Published var statusText = "正在打开云端题库"
    @Published var source: Source = .remote
    @Published var canGoBack = false

    fileprivate weak var webView: WKWebView?

    private let remoteURL = URL(string: "https://zxtt1998.github.io/safety-tech-notebook/index.html?v=20260801-pwa-stable")!

    func attach(_ webView: WKWebView) {
        self.webView = webView
        webView.navigationDelegate = self
        webView.uiDelegate = self
        loadRemote()
    }

    func loadRemote() {
        source = .remote
        statusText = "云端同步可用"
        var request = URLRequest(url: remoteURL)
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.timeoutInterval = 25
        webView?.load(request)
    }

    func loadLocal() {
        source = .local
        statusText = "本地题库模式"
        guard
            let fileURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web"),
            let webDirectory = Bundle.main.url(forResource: "Web", withExtension: nil)
        else {
            statusText = "未找到本地题库文件"
            return
        }
        webView?.loadFileURL(fileURL, allowingReadAccessTo: webDirectory)
    }

    func reload() {
        if let webView, webView.url != nil {
            webView.reload()
        } else if source == .remote {
            loadRemote()
        } else {
            loadLocal()
        }
    }

    func goBack() {
        webView?.goBack()
    }

    fileprivate func updateNavigationState(_ webView: WKWebView) {
        canGoBack = webView.canGoBack
    }
}

extension NotebookWebModel: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        statusText = source == .remote ? "正在读取云端题库" : "正在读取本地题库"
        updateNavigationState(webView)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        statusText = source == .remote ? "云端题库已打开" : "本地题库已打开"
        updateNavigationState(webView)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
        updateNavigationState(webView)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
        updateNavigationState(webView)
    }

    private func handleFailure(_ error: Error) {
        if source == .remote {
            statusText = "云端打开失败，切到本地"
            loadLocal()
        } else {
            statusText = "本地页面打开失败"
        }
    }
}

extension NotebookWebModel: WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        completionHandler()
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        completionHandler(true)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        completionHandler(defaultText)
    }
}

struct NotebookWebView: UIViewRepresentable {
    @ObservedObject var model: NotebookWebModel

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true
        model.attach(webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.updateNavigationState(webView)
    }
}
