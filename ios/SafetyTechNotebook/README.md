# 安全技术错题本 iOS App

这是一个免费的本地 iOS App 工程，不需要上架 App Store。

## 使用方式

1. 安装完整 Xcode。
2. 打开 `SafetyTechNotebook.xcodeproj`。
3. 选择你的 iPhone 或 iOS Simulator。
4. 点击 Run。

App 默认打开 GitHub Pages 云端页面，学习记录和云同步功能沿用网页版。网络失败时会自动切换到 App 内置的本地题库副本。

## 原生效果

外层用 SwiftUI + WKWebView，顶部和底部控制区使用 iOS 系统材质 `.ultraThinMaterial` / `.regularMaterial`，属于原生系统玻璃效果。未来如果你的 Xcode/iOS SDK 已支持新的 Liquid Glass API，可以在这个外壳上继续升级到 Apple 最新的玻璃控件。
