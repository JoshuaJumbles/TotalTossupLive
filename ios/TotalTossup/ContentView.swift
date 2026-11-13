import SwiftUI

/// The spike's whole screen: who is playing, where the Season stands, and
/// how long until the next thing happens.
///
/// There is no art yet on purpose. What this proves is the model -- that
/// a phone can hold a live connection and render correct timing from two
/// timestamps and its own clock, with no game logic aboard.
struct ContentView: View {
    /// Which channel this view is watching.
    ///
    /// Passed in rather than held here, because every store below is
    /// keyed to it and SwiftUI rebuilds them only when the whole view is
    /// replaced. TotalTossupApp owns the choice and gives this view a new
    /// identity when it changes -- see its `.id(channelId)`.
    let channelId: String
    /// Opens the channel picker. Owned above for the same reason.
    let pickChannel: () -> Void

    @StateObject private var client: ChannelClient
    @StateObject private var away: AwayDigestStore
    @EnvironmentObject private var push: PushRegistration
    @Environment(\.scenePhase) private var scenePhase

    init(channelId: String, pickChannel: @escaping () -> Void) {
        self.channelId = channelId
        self.pickChannel = pickChannel
        _client = StateObject(wrappedValue: ChannelClient(channelId: channelId))
        _away = StateObject(wrappedValue: AwayDigestStore(channelId: channelId))
    }

    /// Whether to offer notifications. Held here rather than in
    /// PushRegistration because it is about this screen's timing, not
    /// about the system's answer -- see NotifyPrompt for why the offer
    /// comes before the prompt.
    @State private var offerNotifications = false

    /**
     Whether the record book is up.

     A sheet, and that is a considered choice rather than the easy one.
     The live view *is* the app -- it exists to be watched, and giving it
     a permanent tab bar would spend fifty points of a screen whose whole
     job is showing a Night happen. History is consult-and-return, which
     is a sheet's exact semantics, and presenting it this way commits to
     nothing: it can become a tab or a pushed destination later without
     the screen itself changing a line.

     The real flow question -- tabs, a stack, something else -- wants
     three or four destinations to answer honestly. Picking a container
     for one is guessing, and guessing wrong here means rebuilding the
     live view around it.
     */
    @State private var showingHistory = false

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            if let snapshot = client.snapshot {
                // A standby channel has a perfectly valid snapshot and no
                // alarm scheduled, so nothing will ever advance it. The
                // live view would render a frozen phase and a 0s
                // countdown; see StandbyScreen.
                if snapshot.phase == .standby {
                    VStack(spacing: 0) {
                        header
                        StandbyScreen(channelId: channelId, snapshot: snapshot) {
                            client.connect()
                        }
                    }
                } else {
                    live(snapshot)
                }
            } else {
                waiting
            }
            if let digest = away.digest {
                DigestCard(digest: digest) {
                    away.dismiss()
                    // The best moment there is to ask: they have just
                    // read a list of what they missed.
                    if push.canAsk { offerNotifications = true }
                }
            }
        }
        .animation(.easeOut(duration: 0.2), value: away.digest != nil)
        .animation(.easeOut(duration: 0.2), value: offerNotifications)
        .sheet(isPresented: $showingHistory) {
            HistoryScreen(channelId: channelId) { showingHistory = false }
        }
        // The fallback moment, for someone who has never been away: a
        // minute of watching is enough to know what the app is.
        .task {
            try? await Task.sleep(for: .seconds(60))
            if push.canAsk && away.digest == nil { offerNotifications = true }
        }
        // `onChange(of: scenePhase)` does not fire for the phase the app
        // launches in, so a cold launch -- the other way an absence ends
        // -- is caught here.
        .onAppear {
            client.connect()
            Task { await away.catchUp() }
            // Every launch, and it has to be every launch: a device token
            // is reissued after a restore or an OS upgrade, and an app
            // that registered once goes quietly unreachable weeks later
            // with nothing failing. Never prompts -- see PushRegistration.
            Task { await push.refreshRegistration() }
        }
        .onDisappear { client.disconnect() }
        // Every snapshot moves the watching position along -- throttled
        // inside the store, which also stops writing the moment the scene
        // is no longer active.
        .onChange(of: client.raw) { _, raw in
            if let raw { away.observed(raw) }
        }
        // The absence, both ends of it.
        //
        // iOS gives three phases where the web gave two, and the
        // distinction matters: `.inactive` is a notification shade or the
        // app switcher, which is not being away, while `.background` is.
        // Freezing on `.inactive` would stamp the position every time a
        // banner slid down. Reconnecting is tied to the same signal
        // because the socket does not survive the background either.
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                client.connect()
                Task { await away.catchUp() }
            case .background:
                away.freeze()
                client.disconnect()
            default:
                break
            }
        }
    }

    private var waiting: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text(client.status.label)
                .font(.footnote.weight(.medium))
                .foregroundStyle(Palette.fg.opacity(0.6))
            if let error = client.lastError {
                Text(error)
                    .font(.caption2)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Palette.demons)
                    .padding(.horizontal, 32)
            }
        }
    }

    private func live(_ snapshot: ChannelSnapshot) -> some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 20) {
                    standing(snapshot)
                    if offerNotifications {
                        NotifyPrompt(
                            turnOn: {
                                offerNotifications = false
                                Task { await push.requestIfUseful() }
                            },
                            notNow: { offerNotifications = false }
                        )
                    }
                    // The Sheet itself, when this build knows the Family.
                    // Anything else falls through to the scoreboard, which
                    // is the graceful-degradation path doing its job
                    // rather than a placeholder.
                    if let night = snapshot.bestOfNight, let sheet = snapshot.bestOfSheet {
                        BattleSheet(snapshot: snapshot, night: night, sheet: sheet)
                    }
                    PhaseCard(snapshot: snapshot)
                    scores(snapshot)
                    // A Season of one Week has nothing to pip: the single
                    // box tracks a container that is already the Season,
                    // and rendering it reads as an empty bar rather than
                    // as progress. Several channels run 7/1 presets.
                    if snapshot.weeksPerSeason > 1 {
                        weekPips(snapshot)
                    }
                    sheetLine(snapshot)
                }
                .padding(20)
            }
        }
    }

    private var header: some View {
        HStack(spacing: 6) {
            // The title is the channel control. A second chip in here
            // would crowd a 390pt header that already carries a status
            // dot and the records button, and the channel name belongs
            // with the title anyway -- it is what you are watching.
            Button(action: pickChannel) {
                HStack(spacing: 6) {
                    Text("TOTAL TOSSUP")
                        .font(.system(.headline, design: .rounded).weight(.black))
                        .foregroundStyle(Palette.fg)
                        // The title has to hold its line too: giving the
                        // channel name room to shrink just moved the wrap
                        // onto the wordmark instead.
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if channelId == "main" {
                        Text("LIVE")
                            .font(.system(.headline, design: .rounded).weight(.black).italic())
                            .foregroundStyle(Palette.demons)
                    } else {
                        // Off the main channel, say so where the word
                        // LIVE was: watching `trifecta` and thinking you
                        // are watching the real thing is the one
                        // confusion this feature can cause.
                        Text(channelId.uppercased())
                            .font(.system(.headline, design: .rounded).weight(.black).italic())
                            .foregroundStyle(Palette.humans)
                            // RIVERSHARK and CLOUDFIGHT are long enough to
                            // wrap and push the whole header taller, which
                            // TEAMWORK was already doing. Shrink instead.
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                }
            }
            .buttonStyle(.plain)
            // The title wins the squeeze. Four things now compete for a
            // 390pt header, and the first attempt let "Reconnecting (1)…"
            // shrink the wordmark to "TOTAL T…" -- which is the wrong
            // trade in every case, because the dot beside that text
            // already says the same thing in a colour.
            .layoutPriority(1)
            Spacer(minLength: 4)
            HStack(spacing: 6) {
                Circle()
                    .fill(client.status == .live ? Palette.humans : Palette.demons)
                    .frame(width: 8, height: 8)
                // The word "Live" beside a blue dot says nothing the dot
                // did not, and on a 390pt header carrying a wordmark, a
                // channel name and a button, it was the thing making
                // everything else wrap. So the dot carries the normal
                // case alone and the text appears only when something is
                // actually wrong -- which is also when it earns its room.
                if client.status != .live {
                    Text(client.status.label)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(Palette.fg.opacity(0.6))
                        .lineLimit(1)
                }
            }
            // The way in to the record book. In the header rather than
            // down the page because it is navigation, and navigation
            // that scrolls away is navigation nobody finds.
            Button(action: { showingHistory = true }) {
                Text("RECORDS")
                    .font(.caption2.weight(.black))
                    .foregroundStyle(Palette.bg)
                    // A seven-letter label on a button must never be the
                    // thing that wraps; it broke into "REC/ORD/S" the
                    // moment the title was given priority over it.
                    .fixedSize()
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(Palette.fg)
            }
            .padding(.leading, 4)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(Palette.card)
        .overlay(alignment: .bottom) { Rectangle().fill(Palette.fg).frame(height: 2) }
    }

    private func standing(_ s: ChannelSnapshot) -> some View {
        VStack(spacing: 4) {
            Text("SEASON \(s.seasonNumber)")
                .font(.system(.largeTitle, design: .rounded).weight(.black))
            Text("Week \(s.weekNumber) of \(s.weeksPerSeason)  ·  Night \(s.nightNumber) of \(s.nightsPerWeek)")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Palette.fg.opacity(0.65))
        }
    }

    private func scores(_ s: ChannelSnapshot) -> some View {
        VStack(spacing: 10) {
            ScoreRow(title: "This week", score: s.weekScore)
            ScoreRow(title: "This season", score: s.seasonScore)
            ScoreRow(title: "Seasons won, all time", score: s.lifetimeRecord)
        }
    }

    /// The Season so far, one pip per completed week. The same glanceable
    /// shape a small widget will want.
    private func weekPips(_ s: ChannelSnapshot) -> some View {
        HStack(spacing: 6) {
            ForEach(0..<s.weeksPerSeason, id: \.self) { i in
                let result = s.completedWeeks.first { $0.weekNumber == i + 1 }
                RoundedRectangle(cornerRadius: 3)
                    .fill(result?.winner.map(Palette.side) ?? Palette.card)
                    .overlay(RoundedRectangle(cornerRadius: 3).stroke(Palette.fg, lineWidth: 1.5))
                    .frame(height: 22)
            }
        }
    }

    private func sheetLine(_ s: ChannelSnapshot) -> some View {
        Text("\(s.familyId) · \(s.sheetId)")
            .font(.caption2.monospaced())
            .foregroundStyle(Palette.fg.opacity(0.45))
    }
}

private struct ScoreRow: View {
    let title: String
    let score: ContainerScore

    var body: some View {
        HStack {
            Text("\(score.humans)")
                .font(.system(.title, design: .rounded).weight(.black))
                .foregroundStyle(Palette.humans)
            Spacer()
            Text(title.uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(Palette.fg.opacity(0.55))
            Spacer()
            Text("\(score.demons)")
                .font(.system(.title, design: .rounded).weight(.black))
                .foregroundStyle(Palette.demons)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Palette.card)
        .overlay(RoundedRectangle(cornerRadius: 2).stroke(Palette.fg, lineWidth: 2))
    }
}

/// The phase and its countdown.
///
/// `TimelineView` redraws this on its own schedule and the bar is computed
/// from the snapshot's timestamps each time, so nothing has to be pushed
/// from the server for the countdown to stay correct -- which is the
/// property the whole app, and later the widgets, lean on.
private struct PhaseCard: View {
    let snapshot: ChannelSnapshot

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1.0 / 20.0)) { context in
            let progress = snapshot.progress(at: context.date)
            let remaining = snapshot.remaining(at: context.date)

            VStack(spacing: 10) {
                HStack {
                    Text(snapshot.phase.label.uppercased())
                        .font(.system(.title3, design: .rounded).weight(.heavy))
                    Spacer()
                    Text(remaining > 0 ? String(format: "%.1fs", remaining) : "—")
                        .font(.system(.title3, design: .rounded).weight(.heavy).monospacedDigit())
                        .foregroundStyle(Palette.fg.opacity(0.5))
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Rectangle().fill(Palette.bg)
                        Rectangle()
                            .fill(Palette.fg)
                            .frame(width: geo.size.width * progress)
                    }
                }
                .frame(height: 14)
                .overlay(Rectangle().stroke(Palette.fg, lineWidth: 2))
            }
            .padding(16)
            .overlay(Rectangle().stroke(Palette.fg, lineWidth: 2))
        }
    }
}
