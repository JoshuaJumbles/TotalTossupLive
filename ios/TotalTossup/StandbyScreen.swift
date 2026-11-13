import SwiftUI

/**
 A channel that is asleep, and the button that wakes it.

 Required rather than decorative, and it is the half of channel switching
 that is easy to forget: every channel except `main` ships with
 `autoStart: false`, because an always-on testing channel is real
 Durable Object cost for nobody watching. So switching to `trifecta`
 lands on a snapshot whose phase is `standby`, with no alarm scheduled
 and nothing that will ever advance it. Without this screen the picker
 would appear to work and every channel it offered would look broken.

 The web client has had its own version of this since before the app
 existed; this is the same `POST /start`, which is ungated on purpose --
 starting a Season is not destructive, unlike /reset.
 */
struct StandbyScreen: View {
    let channelId: String
    let snapshot: ChannelSnapshot
    /// Called once the coordinator confirms it has started, so the live
    /// view can take over without waiting for the socket to catch up.
    let started: () -> Void

    @State private var starting = false
    @State private var failed = false

    var body: some View {
        VStack(spacing: 16) {
            Text(channelId.uppercased())
                .font(.system(.largeTitle, design: .rounded).weight(.black))

            Text("\(snapshot.familyId) · \(snapshot.sheetId)")
                .font(.caption.monospaced())
                .foregroundStyle(Palette.fg.opacity(0.5))

            Text("This channel is asleep. It costs nothing while nobody is watching, and nothing will happen on it until someone starts a Season.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(Palette.fg.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 32)

            Button(action: start) {
                Group {
                    if starting {
                        ProgressView().tint(Palette.bg)
                    } else {
                        Text("START A SEASON")
                            .font(.system(.subheadline, design: .rounded).weight(.black))
                            .foregroundStyle(Palette.bg)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Palette.fg)
            }
            .disabled(starting)
            .padding(.horizontal, 32)
            .padding(.top, 4)

            if failed {
                Text("That did not take. Try again.")
                    .font(.caption)
                    .foregroundStyle(Palette.demons)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func start() {
        starting = true
        failed = false
        Task {
            var request = URLRequest(url: Endpoints.start(channelId: channelId))
            request.httpMethod = "POST"
            request.timeoutInterval = 15
            defer { starting = false }
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                    failed = true
                    return
                }
                // The route answers with the snapshot it just committed,
                // so by the time this returns the channel really is
                // running -- no need to poll, and the socket's next
                // broadcast will say the same thing a beat later.
                started()
            } catch {
                failed = true
            }
        }
    }
}
