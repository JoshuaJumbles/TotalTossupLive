import SwiftUI

/// The spike's whole screen: who is playing, where the Season stands, and
/// how long until the next thing happens.
///
/// There is no art yet on purpose. What this proves is the model -- that
/// a phone can hold a live connection and render correct timing from two
/// timestamps and its own clock, with no game logic aboard.
struct ContentView: View {
    @StateObject private var client = ChannelClient(channelId: "main")

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            if let snapshot = client.snapshot {
                live(snapshot)
            } else {
                waiting
            }
        }
        .onAppear { client.connect() }
        .onDisappear { client.disconnect() }
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
                    // The Sheet itself, when this build knows the Family.
                    // Anything else falls through to the scoreboard, which
                    // is the graceful-degradation path doing its job
                    // rather than a placeholder.
                    if let night = snapshot.bestOfNight, let sheet = snapshot.bestOfSheet {
                        BattleSheet(snapshot: snapshot, night: night, sheet: sheet)
                    }
                    PhaseCard(snapshot: snapshot)
                    scores(snapshot)
                    weekPips(snapshot)
                    sheetLine(snapshot)
                }
                .padding(20)
            }
        }
    }

    private var header: some View {
        HStack {
            Text("TOTAL TOSSUP")
                .font(.system(.headline, design: .rounded).weight(.black))
            Text("LIVE")
                .font(.system(.headline, design: .rounded).weight(.black).italic())
                .foregroundStyle(Palette.demons)
            Spacer()
            HStack(spacing: 6) {
                Circle()
                    .fill(client.status == .live ? Palette.humans : Palette.demons)
                    .frame(width: 8, height: 8)
                Text(client.status.label)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(Palette.fg.opacity(0.6))
            }
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
