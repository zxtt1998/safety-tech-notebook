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

            if model.isLoading {
                VStack(spacing: 14) {
                    ProgressView()
                        .controlSize(.large)
                    Text(model.statusText)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 22)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .strokeBorder(.white.opacity(0.5), lineWidth: 1)
                }
                .shadow(color: .black.opacity(0.14), radius: 24, y: 12)
            }

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
    @Namespace private var liquidNamespace
    @State private var shimmerPhase = false

    var body: some View {
        HStack(spacing: 6) {
            LiquidDockButton(
                title: "云端",
                systemImage: model.source == .remote ? "icloud.fill" : "icloud",
                isActive: model.source == .remote,
                namespace: liquidNamespace
            ) {
                withAnimation(.snappy(duration: 0.46, extraBounce: 0.22)) {
                    model.loadRemote()
                }
            }

            LiquidDockButton(
                title: "本地",
                systemImage: model.source == .local ? "iphone.gen3.radiowaves.left.and.right" : "iphone.gen3",
                isActive: model.source == .local,
                namespace: liquidNamespace
            ) {
                withAnimation(.snappy(duration: 0.46, extraBounce: 0.22)) {
                    model.loadLocal()
                }
            }

            LiquidBackButton(isEnabled: model.canGoBack) {
                model.goBack()
            }
        }
        .padding(7)
        .background {
            Capsule(style: .continuous)
                .fill(.regularMaterial)
                .overlay {
                    Capsule(style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    .white.opacity(0.34),
                                    .white.opacity(0.1),
                                    .cyan.opacity(0.12),
                                    .black.opacity(0.08)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .blendMode(.plusLighter)
                }
                .overlay {
                    Capsule(style: .continuous)
                        .strokeBorder(
                            AngularGradient(
                                colors: [
                                    .white.opacity(0.78),
                                    .cyan.opacity(0.24),
                                    .purple.opacity(0.18),
                                    .orange.opacity(0.22),
                                    .white.opacity(0.62)
                                ],
                                center: .center,
                                angle: .degrees(shimmerPhase ? 28 : -18)
                            ),
                            lineWidth: 1.25
                        )
                        .opacity(0.72)
                }
                .overlay(alignment: .topLeading) {
                    Capsule(style: .continuous)
                        .fill(.white.opacity(0.34))
                        .frame(width: 142, height: 16)
                        .blur(radius: 16)
                        .offset(x: shimmerPhase ? 188 : 18, y: 3)
                        .opacity(0.68)
                }
                .shadow(color: .white.opacity(0.45), radius: 10, y: -2)
                .shadow(color: .black.opacity(0.2), radius: 26, y: 12)
        }
        .overlay {
            Capsule(style: .continuous)
                .stroke(.white.opacity(0.28), lineWidth: 0.5)
                .padding(1.5)
        }
        .animation(.easeInOut(duration: 3.2).repeatForever(autoreverses: true), value: shimmerPhase)
        .onAppear { shimmerPhase = true }
    }
}

private struct LiquidDockButton: View {
    let title: String
    let systemImage: String
    let isActive: Bool
    let namespace: Namespace.ID
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: systemImage)
                    .font(.system(size: 19, weight: .bold))
                    .symbolEffect(.bounce, value: isActive)
                Text(title)
                    .font(.system(size: 12.5, weight: .heavy, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
            }
            .foregroundStyle(isActive ? .white : Color.primary.opacity(0.78))
            .frame(width: 86, height: 58)
            .background {
                if isActive {
                    LiquidLens()
                        .matchedGeometryEffect(id: "liquidLens", in: namespace)
                }
            }
            .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(LiquidPressButtonStyle())
        .accessibilityLabel(title)
    }
}

private struct LiquidBackButton: View {
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.left")
                .font(.system(size: 17, weight: .heavy))
                .foregroundStyle(isEnabled ? Color.primary.opacity(0.78) : Color.secondary.opacity(0.45))
                .frame(width: 52, height: 58)
                .background {
                    Capsule(style: .continuous)
                        .fill(.white.opacity(isEnabled ? 0.16 : 0.07))
                        .overlay {
                            Capsule(style: .continuous)
                                .strokeBorder(.white.opacity(0.24), lineWidth: 0.8)
                        }
                }
                .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(LiquidPressButtonStyle())
        .disabled(!isEnabled)
        .accessibilityLabel("返回")
    }
}

private struct LiquidLens: View {
    var body: some View {
        Capsule(style: .continuous)
            .fill(.ultraThinMaterial)
            .overlay {
                Capsule(style: .continuous)
                    .fill(
                        RadialGradient(
                            colors: [.white.opacity(0.56), .cyan.opacity(0.18), .clear],
                            center: .topLeading,
                            startRadius: 4,
                            endRadius: 78
                        )
                    )
                    .blendMode(.plusLighter)
            }
            .overlay {
                Capsule(style: .continuous)
                    .strokeBorder(
                        AngularGradient(
                            colors: [
                                .white.opacity(0.94),
                                .cyan.opacity(0.38),
                                .purple.opacity(0.26),
                                .orange.opacity(0.3),
                                .white.opacity(0.8)
                            ],
                            center: .center
                        ),
                        lineWidth: 1.4
                    )
            }
            .overlay(alignment: .topLeading) {
                Capsule(style: .continuous)
                    .fill(.white.opacity(0.5))
                    .frame(width: 58, height: 10)
                    .blur(radius: 7)
                    .offset(x: 13, y: 6)
            }
            .shadow(color: .cyan.opacity(0.24), radius: 16, y: 2)
            .shadow(color: .black.opacity(0.2), radius: 18, y: 10)
    }
}

private struct LiquidPressButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.92 : 1)
            .blur(radius: configuration.isPressed ? 0.2 : 0)
            .animation(.spring(response: 0.24, dampingFraction: 0.62), value: configuration.isPressed)
    }
}
