import SwiftUI

/// Column layout for a side's units, ported from web/src/lib/unitLayout.ts.
///
/// Both clients have to agree on this or the two platforms would draw the
/// same Night differently, so the numbers are copied rather than
/// re-derived: one column up to 3 units, two up to 9, three beyond, with
/// uneven remainders going to the outer columns first.
enum UnitLayout {
    static let overlap = 0.28
    static let stagger = 0.5

    static func columnCounts(_ n: Int) -> [Int] {
        let columns = n <= 3 ? 1 : n <= 9 ? 2 : 3
        let base = n / columns
        let remainder = n % columns
        return (0..<columns).map { base + ($0 < remainder ? 1 : 0) }
    }
}

/// One side's figure: Joshua's fill/line pair, each tinted separately.
///
/// Both PNGs are alpha-only silhouettes, so they are drawn as templates
/// over the scheme's own fill and line colours rather than used as
/// pictures. That is what lets a palette change recolour the art, and it
/// is the same technique TeamArt uses on the web.
private struct UnitFigure: View {
    let side: Side

    var body: some View {
        ZStack {
            Image(side == .humans ? "human-fill" : "demon-fill")
                .resizable()
                .renderingMode(.template)
                .foregroundStyle(Palette.unitFill)
            Image(side == .humans ? "human-lines" : "demon-lines")
                .resizable()
                .renderingMode(.template)
                .foregroundStyle(Palette.unitLine)
        }
        .aspectRatio(1, contentMode: .fit)
    }
}

/// A crossed-off unit's permanent mark, in the colour of the side that
/// crossed it -- the physical game's own pen convention.
private struct CrossOutMark: View {
    let markColor: Color
    /// 0...1 while the mark that just landed draws itself, 1 for every
    /// mark already on the page.
    let drawn: Double

    var body: some View {
        Image("strikethrough-ink")
            .resizable()
            .renderingMode(.template)
            .foregroundStyle(markColor)
            .aspectRatio(1, contentMode: .fit)
            // A vertical wipe stands in for the authored reveal: the mark
            // grows downward as it is drawn, the same direction the web's
            // clip-path runs.
            .mask(alignment: .top) {
                GeometryReader { geo in
                    Rectangle().frame(height: geo.size.height * drawn)
                }
            }
    }
}

/// One side's units, columned and staggered the way the printed Sheet
/// arranges them.
struct UnitColumns: View {
    let side: Side
    let total: Int
    let size: CGFloat
    let crossed: Set<Int>
    let justCrossed: Int?
    let drawn: Double

    /// Where each column's run of units begins in the side's own index
    /// space -- which is what the cross order addresses.
    private var columnStarts: [Int] {
        var starts: [Int] = []
        var running = 0
        for count in UnitLayout.columnCounts(total) {
            starts.append(running)
            running += count
        }
        return starts
    }

    var body: some View {
        let counts = UnitLayout.columnCounts(total)
        let starts = columnStarts
        // Demons mirror, so each side's deepest column sits toward the
        // middle of the Sheet rather than both leaning the same way.
        let order: [Int] = side == .demons ? Array(counts.indices).reversed() : Array(counts.indices)

        HStack(alignment: .bottom, spacing: 0) {
            ForEach(order, id: \.self) { column in
                VStack(spacing: -size * UnitLayout.overlap) {
                    ForEach(0..<counts[column], id: \.self) { row in
                        let index = starts[column] + row
                        ZStack {
                            UnitFigure(side: side)
                            if crossed.contains(index) {
                                CrossOutMark(
                                    markColor: Palette.side(side.other),
                                    drawn: index == justCrossed ? drawn : 1
                                )
                            }
                        }
                        .frame(width: size, height: size)
                    }
                }
                .padding(.bottom, CGFloat(column) * UnitLayout.stagger * size)
            }
        }
    }
}

/// The Battle Sheet: both lines of units facing each other, with the
/// round's coins beneath.
struct BattleSheet: View {
    let snapshot: ChannelSnapshot
    let night: BestOfNightState
    let sheet: BestOfSheetConfig

    /// Whichever side just lost a round is the one with a fresh mark. The
    /// newest entry in their cross order is the unit it landed on -- the
    /// same derivation the web screen makes, from the same broadcast data.
    private var justCrossed: (side: Side, index: Int)? {
        guard snapshot.phase == .roundResolved else { return nil }
        let winner: Side? = night.currentRound.flipWins.humans > night.currentRound.flipWins.demons
            ? .humans
            : night.currentRound.flipWins.demons > night.currentRound.flipWins.humans ? .demons : nil
        guard let winner else { return nil }
        let loser = winner.other
        let scored = winner == .humans ? night.roundPoints.humans : night.roundPoints.demons
        guard scored > 0, scored <= snapshot.unitCrossOrder[loser].count else { return nil }
        return (loser, snapshot.unitCrossOrder[loser][scored - 1])
    }

    var body: some View {
        // A unit crossed this round draws itself across the pause, from
        // the phase's own timestamps -- nothing is pushed to animate it.
        TimelineView(.periodic(from: .now, by: 1.0 / 20.0)) { context in
            let drawn = snapshot.phase == .roundResolved ? snapshot.progress(at: context.date) : 1

            VStack(spacing: 14) {
                GeometryReader { geo in
                    let size = unitSize(in: geo.size)
                    HStack(alignment: .bottom, spacing: size * 0.4) {
                        UnitColumns(
                            side: .humans,
                            total: sheet.targetRoundPoints,
                            size: size,
                            crossed: Set(snapshot.unitCrossOrder.humans.prefix(night.roundPoints.demons)),
                            justCrossed: justCrossed?.side == .humans ? justCrossed?.index : nil,
                            drawn: drawn
                        )
                        UnitColumns(
                            side: .demons,
                            total: sheet.targetRoundPoints,
                            size: size,
                            crossed: Set(snapshot.unitCrossOrder.demons.prefix(night.roundPoints.humans)),
                            justCrossed: justCrossed?.side == .demons ? justCrossed?.index : nil,
                            drawn: drawn
                        )
                    }
                    .frame(width: geo.size.width, height: geo.size.height, alignment: .bottom)
                }
                .frame(height: 260)

                CoinRow(flips: night.currentRound.flips, slots: sheet.roundSize)
            }
        }
    }

    /// Scales the figures so both lines fit the space they're given,
    /// whether a Night fields three units or thirteen.
    private func unitSize(in box: CGSize) -> CGFloat {
        let counts = UnitLayout.columnCounts(sheet.targetRoundPoints)
        let columns = CGFloat(counts.count)
        let tallest = CGFloat(counts.max() ?? 1)
        // Two lines side by side, plus a gap between them.
        let byWidth = box.width / (columns * 2 + 0.4)
        // A column's own height, plus however far the outer ones are
        // staggered down.
        let stackedRows = tallest - (tallest - 1) * UnitLayout.overlap
        let byHeight = box.height / (stackedRows + (columns - 1) * UnitLayout.stagger)
        return max(18, min(byWidth, byHeight))
    }
}

/// The round's coins. Unflipped slots show as empty ovals, the way the
/// web row does.
struct CoinRow: View {
    let flips: [Flip]
    let slots: Int

    var body: some View {
        HStack(spacing: 10) {
            ForEach(0..<slots, id: \.self) { i in
                let face = i < flips.count ? flips[i].face : nil
                ZStack {
                    Circle()
                        .fill(face == nil ? Palette.card : Palette.bg)
                        .overlay(Circle().stroke(Palette.fg, lineWidth: face == nil ? 1.5 : 2.5))
                    if let face {
                        Text(face.letter)
                            .font(.system(.subheadline, design: .rounded).weight(.black))
                    }
                }
                .frame(width: 34, height: 34)
                .opacity(face == nil ? 0.45 : 1)
            }
        }
    }
}
