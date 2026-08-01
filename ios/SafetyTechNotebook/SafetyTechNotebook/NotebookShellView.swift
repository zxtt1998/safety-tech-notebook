import SwiftUI
import WebKit

struct NotebookShellView: View {
    @StateObject private var model = NotebookWebModel()

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.76, green: 0.88, blue: 1.0),
                    Color(red: 0.94, green: 0.97, blue: 1.0),
                    Color.white
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            NotebookWebView(model: model)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                AppGlassHeader(model: model)
                    .padding(.horizontal, 14)
                    .padding(.top, 8)

                Spacer(minLength: 0)

                AppGlassDock(model: model)
                    .padding(.horizontal, 18)
                    .padding(.bottom, 10)
            }
        }
        .preferredColorScheme(.light)
    }
}

private struct AppGlassHeader: View {
    @ObservedObject var model: NotebookWebModel

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("安全技术错题本")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)
                Text(model.statusText)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                model.reload()
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("刷新")
        }
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(.white.opacity(0.46), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.14), radius: 24, y: 12)
    }
}

private struct AppGlassDock: View {
    @ObservedObject var model: NotebookWebModel

    var body: some View {
        HStack(spacing: 8) {
            Button {
                model.loadRemote()
            } label: {
                Label("云端", systemImage: "icloud")
            }
            .buttonStyle(GlassPillButtonStyle(isActive: model.source == .remote))

            Button {
                model.loadLocal()
            } label: {
                Label("本地", systemImage: "iphone")
            }
            .buttonStyle(GlassPillButtonStyle(isActive: model.source == .local))

            Button {
                model.goBack()
            } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 42, height: 42)
            }
            .buttonStyle(GlassIconButtonStyle())
            .disabled(!model.canGoBack)
        }
        .padding(8)
        .background(.regularMaterial, in: Capsule())
        .overlay {
            Capsule()
                .strokeBorder(.white.opacity(0.52), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.18), radius: 24, y: 10)
    }
}

private struct GlassPillButtonStyle: ButtonStyle {
    var isActive: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .bold, design: .rounded))
            .foregroundStyle(isActive ? .white : .primary)
            .labelStyle(.titleAndIcon)
            .padding(.horizontal, 16)
            .frame(height: 42)
            .background {
                if isActive {
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [Color.blue, Color.teal],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                } else {
                    Capsule().fill(.white.opacity(configuration.isPressed ? 0.42 : 0.22))
                }
            }
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.28, dampingFraction: 0.82), value: configuration.isPressed)
    }
}

private struct GlassIconButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(.primary)
            .background(.white.opacity(configuration.isPressed ? 0.34 : 0.2), in: Circle())
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(response: 0.28, dampingFraction: 0.82), value: configuration.isPressed)
    }
}
