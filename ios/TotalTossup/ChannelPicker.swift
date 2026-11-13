import SwiftUI

/**
 Which channel to watch.

 ## Why this came before another Family renderer

 There are four Family engines running on the server and one Sheet
 renderer in this app, so "add more Family support" looks like the next
 job. It cannot be, in this order: the app was hardcoded to `main` in
 four places and `main` rotates nothing but Battle Sheets, so there was
 no way to put a Teamwork or Trifecta Night on the screen at all --
 however well it was drawn.

 It also pays off before any art exists. `ChannelSnapshot` decodes
 Family-specific state only for Families this build knows and falls
 through to the plain scoreboard otherwise, so switching to `trifecta`
 today shows its real scores, phases and timing with no Sheet art. That
 is the graceful-degradation path finally being worth something rather
 than being a promise, and it makes each renderer independently
 assessable as it lands.

 ## It says what it cannot draw

 Rows carry a marker when this build has no renderer for the channel's
 styles. Flattering it would hide the one thing the screen is for.
 */
@MainActor
final class ChannelDirectoryStore: ObservableObject {
    @Published private(set) var channels: [ChannelListing] = []
    @Published private(set) var failed = false

    func load() async {
        var request = URLRequest(url: Endpoints.channels)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 10
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                failed = true
                return
            }
            channels = try JSONDecoder().decode(ChannelDirectory.self, from: data).channels
            failed = false
        } catch {
            failed = true
        }
    }
}

struct ChannelPicker: View {
    let current: String
    let choose: (String) -> Void
    let dismiss: () -> Void

    @StateObject private var store = ChannelDirectoryStore()

    var body: some View {
        VStack(spacing: 0) {
            header
            if store.failed && store.channels.isEmpty {
                VStack(spacing: 8) {
                    Text("The channel list could not be reached.")
                        .font(.footnote)
                        .foregroundStyle(Palette.fg.opacity(0.7))
                    Button(action: { Task { await store.load() } }) {
                        Text("TRY AGAIN")
                            .font(.system(.footnote, design: .rounded).weight(.black))
                            .foregroundStyle(Palette.bg)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(Palette.fg)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(store.channels) { channel in
                            Button {
                                choose(channel.id)
                            } label: {
                                ChannelRow(channel: channel, isCurrent: channel.id == current)
                            }
                            .buttonStyle(.plain)
                        }

                        Text("Every channel runs the same coordinator with a different preset. Only MAIN starts itself; the rest sleep until you wake them, which costs nothing while nobody is watching.")
                            .font(.caption2)
                            .foregroundStyle(Palette.fg.opacity(0.5))
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 6)
                    }
                    .padding(20)
                }
            }
        }
        .background(Palette.bg)
        .task { await store.load() }
    }

    private var header: some View {
        HStack {
            Text("CHANNELS")
                .font(.system(.headline, design: .rounded).weight(.black))
            Spacer()
            Button(action: dismiss) {
                Text("DONE")
                    .font(.system(.footnote, design: .rounded).weight(.black))
                    .foregroundStyle(Palette.fg.opacity(0.6))
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(Palette.card)
        .overlay(alignment: .bottom) { Rectangle().fill(Palette.fg).frame(height: 2) }
    }
}

private struct ChannelRow: View {
    let channel: ChannelListing
    let isCurrent: Bool

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(channel.id.uppercased())
                        .font(.system(.subheadline, design: .rounded).weight(.black))
                    if isCurrent {
                        Text("WATCHING")
                            .font(.caption2.weight(.black))
                            .foregroundStyle(Palette.bg)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Palette.humans)
                    }
                }

                Text("\(channel.familyIds.joined(separator: ", ")) · \(channel.containerShape) · \(styleSummary)")
                    .font(.caption2)
                    .foregroundStyle(Palette.fg.opacity(0.55))
                    .fixedSize(horizontal: false, vertical: true)

                if !channel.hasRenderer {
                    // The honest marker. This build renders Battle Sheets
                    // and nothing else, so everything but main and battle
                    // falls back to the scoreboard -- which is still a
                    // correct, live view of the channel, just unpainted.
                    Text("No Sheet art in this build — scoreboard only")
                        .font(.caption2)
                        .foregroundStyle(Palette.demons.opacity(0.9))
                }
            }

            Spacer(minLength: 4)

            if !channel.autoStart {
                Text("ASLEEP")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Palette.fg.opacity(0.5))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isCurrent ? Palette.card : Palette.bg)
        .overlay(Rectangle().stroke(Palette.fg.opacity(isCurrent ? 1 : 0.25), lineWidth: 2))
    }

    private var styleSummary: String {
        channel.styles.count == 1
            ? channel.styles[0]
            : "\(channel.styles.count) Sheets"
    }
}
