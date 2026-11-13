import SwiftUI

/**
 The record book: every all-time mark, and the Seasons the ring still
 remembers.

 ## Two sections, and the order is the argument

 Records first. They are the part that does not expire -- "the longest
 reign ever is 51 Seasons, by the Demons" is as true next month as it is
 now -- and they are the thing a reader came here for. Recent Seasons
 below, because a list of results is reference material rather than news;
 it answers "what did I miss" only until the digest has already answered
 it better.

 ## Nothing here ranks anything

 There is no floor, no weight and no notion of which record is the
 interesting one. That restraint is the point: the sender and the digest
 exist precisely to decide what is worth interrupting someone for, and a
 screen the reader chose to open is the one place in this project where
 that machinery should stay out of the way. Everything the ring kept is
 shown, in order, and the reader decides.

 ## Saying where the claims begin

 The ledger opened on a channel that had already played twelve hundred
 Seasons, and nothing can recover what the biggest lead was across them.
 So "all-time" here means "since Season 1,216" and the screen prints that
 rather than hoping nobody asks. It is one line, and it is the difference
 between a record book and a claim.
 */
struct HistoryScreen: View {
    @StateObject private var store: HistoryStore
    let dismiss: () -> Void

    init(channelId: String, dismiss: @escaping () -> Void) {
        _store = StateObject(wrappedValue: HistoryStore(channelId: channelId))
        self.dismiss = dismiss
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            content
        }
        .background(Palette.bg)
        .task { await store.load() }
    }

    private var header: some View {
        HStack {
            Text("RECORD BOOK")
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

    @ViewBuilder
    private var content: some View {
        switch store.state {
        case .idle, .loading:
            VStack(spacing: 12) {
                ProgressView()
                Text("Reading the record book…")
                    .font(.footnote)
                    .foregroundStyle(Palette.fg.opacity(0.6))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

        case .failed(let message):
            VStack(spacing: 14) {
                Text(message)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Palette.fg.opacity(0.7))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 24)
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

        case .loaded(let history):
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    records(history.records)
                    seasons(history.seasons)
                }
                .padding(20)
            }
        }
    }

    // MARK: - Records

    private func records(_ ledger: RecordLedger) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading("ALL-TIME RECORDS")

            ForEach(RecordId.allCases, id: \.self) { id in
                RecordRow(id: id, standing: ledger.standing(of: id))
            }

            // The honest line. Small, grey, and never omitted.
            Text("Kept since Season \(ledger.since.seasonNumber.formatted()). Anything before that was never recorded.")
                .font(.caption2)
                .foregroundStyle(Palette.fg.opacity(0.5))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        }
    }

    // MARK: - Seasons

    private func seasons(_ ring: [SeasonSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Newest first here, though the wire sends oldest first: the
            // ring's order is for the digest, which narrates an absence
            // forwards. A reader scanning a list wants the most recent
            // thing at the top.
            let newestFirst = ring.reversed()

            SectionHeading("RECENT SEASONS")

            if ring.isEmpty {
                Text("No Seasons have closed since the channel started keeping them.")
                    .font(.footnote)
                    .foregroundStyle(Palette.fg.opacity(0.6))
            } else {
                ForEach(Array(newestFirst)) { season in
                    SeasonRow(season: season)
                }
                Text("The last \(ring.count) Seasons. Older ones are not kept.")
                    .font(.caption2)
                    .foregroundStyle(Palette.fg.opacity(0.5))
                    .padding(.top, 2)
            }
        }
    }
}

private struct SectionHeading: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.caption.weight(.bold))
            .foregroundStyle(Palette.fg.opacity(0.55))
    }
}

/// One all-time record. Shows the holder, or says it is shared -- see
/// `RecordLedger.standing` for why a level record is its own state and
/// not an absence.
private struct RecordRow: View {
    let id: RecordId
    let standing: RecordLedger.Standing

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(id.title.uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Palette.fg.opacity(0.6))
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(Palette.fg.opacity(0.5))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 0) {
                Text(value)
                    .font(.system(.largeTitle, design: .rounded).weight(.black))
                    .foregroundStyle(valueColour)
                if case .unset = standing {} else {
                    Text(unit.uppercased())
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Palette.fg.opacity(0.45))
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Palette.card)
        .overlay(Rectangle().stroke(Palette.fg, lineWidth: 2))
    }

    private var subtitle: String {
        switch standing {
        case let .held(side, mark):
            return "\(sideName(side)) · Season \(mark.seasonNumber.formatted()) · \(dateLabel(mark.setOn))"
        case let .level(_, mark):
            // Says who is level and when it was last reached, which is
            // strictly more than the old "not yet held outright" and
            // uses marks the screen already had.
            return "Shared · last reached Season \(mark.seasonNumber.formatted()) · \(dateLabel(mark.setOn))"
        case .unset:
            return "Not set yet"
        }
    }

    private var value: String {
        switch standing {
        case let .held(_, mark): return "\(mark.value)"
        case let .level(value, _): return "\(value)"
        case .unset: return "—"
        }
    }

    private var unit: String {
        switch standing {
        case let .held(_, mark): return id.unit(mark.value)
        case let .level(value, _): return id.unit(value)
        case .unset: return ""
        }
    }

    /// A shared record belongs to neither side, so it is set in the
    /// foreground colour rather than picking one of the two.
    private var valueColour: Color {
        switch standing {
        case let .held(side, _): return Palette.side(side)
        case .level: return Palette.fg
        case .unset: return Palette.fg.opacity(0.25)
        }
    }
}

/// One settled Season, as a row rather than a sentence.
private struct SeasonRow: View {
    let season: SeasonSummary

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text("SEASON \(season.seasonNumber.formatted())")
                        .font(.system(.subheadline, design: .rounded).weight(.black))
                    if let winner = season.winner {
                        Text(sideName(winner).uppercased())
                            .font(.caption2.weight(.black))
                            .foregroundStyle(Palette.bg)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Palette.side(winner))
                    }
                }

                HStack(spacing: 6) {
                    Text(dateLabel(season.endedOn))
                    if season.wasSweep {
                        Badge("SWEEP")
                    } else if season.wentTheDistance {
                        Badge("WEEK \(season.weeks.count) DECIDER")
                    }
                    // A record falling is the rarest thing a Season can
                    // carry, so it is said even though this screen ranks
                    // nothing else -- it is a fact about the Season, not a
                    // judgement about it.
                    if let broken = season.records, !broken.isEmpty {
                        Badge("RECORD")
                    }
                }
                .font(.caption2)
                .foregroundStyle(Palette.fg.opacity(0.55))
            }

            Spacer(minLength: 4)

            // Winner's figure first, which is the one place in this
            // project that does not put the Humans on the left. Everywhere
            // else a score is a standing and fixed sides make it readable
            // at a glance; here the row has just named a winner, and
            // "Demons · 1-4" reads as though they got one. The same bug
            // was found in the digest's copy and fixed the same way.
            Text(winnerFirstScore)
                .font(.system(.title3, design: .rounded).weight(.black).monospacedDigit())
                .foregroundStyle(season.winner.map(Palette.side) ?? Palette.fg)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .overlay(Rectangle().stroke(Palette.fg.opacity(0.25), lineWidth: 2))
    }

    private var winnerFirstScore: String {
        let tally = season.weekTally
        guard let winner = season.winner else { return "\(tally.humans)-\(tally.demons)" }
        let won = winner == .humans ? tally.humans : tally.demons
        let lost = winner == .humans ? tally.demons : tally.humans
        return "\(won)-\(lost)"
    }
}

private struct Badge: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.caption2.weight(.bold))
            .foregroundStyle(Palette.fg.opacity(0.7))
            .padding(.horizontal, 4)
            .padding(.vertical, 1)
            .overlay(Rectangle().stroke(Palette.fg.opacity(0.3), lineWidth: 1))
    }
}

private func sideName(_ side: Side) -> String {
    side == .humans ? "Humans" : "Demons"
}

/// "9 Nov" / "9 Nov 2025". Joshua's framing for this screen was "numbers
/// and dates of notable record breaking mention", so a mark without a
/// date is only half of it.
private func dateLabel(_ date: Date) -> String {
    // Two formats rather than `.year(.omitted)`, which needs iOS 18 and
    // this app targets 17. The year is dropped inside the current one
    // because a record book read in November does not need to be told
    // that November was this year.
    let calendar = Calendar.current
    let sameYear = calendar.component(.year, from: date) == calendar.component(.year, from: .now)
    return sameYear
        ? date.formatted(.dateTime.day().month(.abbreviated))
        : date.formatted(.dateTime.day().month(.abbreviated).year())
}
