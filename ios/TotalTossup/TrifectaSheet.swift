import SwiftUI

/**
 Every Trifecta Sheet, drawn by one view.

 Same arrangement as Teamwork's: scene above, coin grid below, one
 renderer for all six Sheets with the per-Sheet differences as data. What
 Trifecta adds is a different kind of mark and a different kind of grid
 cell.

 ## The marks are vector, and that is the point

 A Teamwork mark is one strikethrough image at a known cell. A Trifecta
 mark is an authored burst or scribble of several strokes, and a mark's
 *position is its path data* -- Joshua draws them laid out in place over
 the scene, so there is no geometry table to go with them. They are
 stroked, not filled, with a miter limit rather than round joins, because
 the spiked reversals are the line style and rounding them off would
 flatten exactly what makes them not read as pipes.

 The one mark landing now is revealed along its own length. The hand that
 follows the pen on the web is deliberately not here yet: it is a
 scene-level layer at a constant scene-relative size, which is its own
 piece of work rather than a detail of this one.

 ## Whose colour a mark is

 The *other* side's. A human target is crossed off in the demons' colour,
 matching the physical game's pen convention -- you mark what you
 destroyed. Worth stating because it inverts for a later Family: Creation
 has each team filling in its own shape, so the mark becomes the filler's
 colour. That makes this a per-Family rule, not a constant.
 */
private let sceneWidth: Double = 409
private let sceneHeight: Double = 311
private let gridHeight: Double = 166

struct TrifectaSheet: View {
    let snapshot: ChannelSnapshot
    let night: TrifectaNightState
    let config: TrifectaSheetConfig
    let art: TrifectaSheetArt
    let marks: DrawnMarkSet

    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { geo in
                let scale = geo.size.width / sceneWidth
                ZStack(alignment: .topLeading) {
                    Image(art.sceneImage)
                        .resizable()
                        .renderingMode(.template)
                        .foregroundStyle(Palette.fg)

                    TrifectaMarks(
                        night: night,
                        marks: marks,
                        phaseDuration: snapshot.phaseEnd.timeIntervalSince(snapshot.phaseStart)
                    )

                    Text("NIGHT \(snapshot.nightNumber)")
                        .font(.system(size: 24 * scale, design: .rounded).weight(.black))
                        .foregroundStyle(Palette.fg)
                        .offset(x: art.labelLeft * geo.size.width, y: art.labelTop * geo.size.height)
                }
                .frame(width: geo.size.width, height: geo.size.height)
                .overlay(Rectangle().stroke(Palette.fg, lineWidth: 3))
            }
            .aspectRatio(sceneWidth / sceneHeight, contentMode: .fit)

            TrifectaGrid(
                config: config,
                art: art,
                activated: night.activated,
                revealed: night.currentRound.flips.map(\.face)
            )
            .aspectRatio(sceneWidth / gridHeight, contentMode: .fit)
        }
    }
}

/// Whoever crossed a target off is the other side -- see the type comment.
private func markColour(for side: Side) -> Color {
    Palette.side(side == .humans ? .demons : .humans)
}

private struct TrifectaMarks: View {
    let night: TrifectaNightState
    let marks: DrawnMarkSet
    let phaseDuration: TimeInterval

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach([Side.humans, Side.demons], id: \.self) { side in
                    ForEach(night.destroyed(side), id: \.self) { target in
                        MarkView(
                            strokes: marks.strokes(for: side, target: target) ?? [],
                            viewBox: marks.viewBox,
                            strokeWidth: marks.strokeWidth,
                            colour: markColour(for: side),
                            size: geo.size,
                            // Only the marks this round just landed draw
                            // themselves; everything else is settled ink.
                            isDrawing: night.lastRound?.side == side
                                && night.lastRound?.targets.contains(target) == true,
                            phaseDuration: phaseDuration
                        )
                    }
                }
            }
        }
    }
}

/// One target's mark: its strokes, in order.
private struct MarkView: View {
    let strokes: [MarkStroke]
    let viewBox: MarkViewBox
    let strokeWidth: Double
    let colour: Color
    let size: CGSize
    let isDrawing: Bool
    let phaseDuration: TimeInterval

    @State private var progress: Double = 0

    var body: some View {
        // The scene is stretched to the export's box rather than fitted
        // inside it, so the marks line up with the art exactly instead of
        // being letterboxed against it. An export's own box is not always
        // the scene rect -- Ambush's is wider -- which is why the
        // extractor records it per Sheet.
        let sx = size.width / viewBox.width
        let sy = size.height / viewBox.height

        ZStack(alignment: .topLeading) {
            ForEach(Array(strokes.enumerated()), id: \.offset) { index, stroke in
                if let path = MarkPathParser.path(from: stroke.d) {
                    path
                        .trimmedPath(from: 0, to: isDrawing ? drawn(index) : 1)
                        .transform(
                            CGAffineTransform(scaleX: sx, y: sy)
                                .translatedBy(x: -viewBox.minX, y: -viewBox.minY)
                        )
                        .stroke(
                            colour,
                            style: StrokeStyle(
                                lineWidth: strokeWidth * min(sx, sy),
                                lineCap: .butt,
                                // Miter, not round: the sharp reversals
                                // are what give these strokes their
                                // spiked ends. Rounding them off is the
                                // one change that would make them read as
                                // uniform pipes.
                                lineJoin: .miter,
                                miterLimit: 10
                            )
                        )
                }
            }
        }
        .onAppear {
            guard isDrawing, phaseDuration > 0 else {
                progress = 1
                return
            }
            withAnimation(.linear(duration: min(phaseDuration, 1.2))) { progress = 1 }
        }
    }

    /// How much of stroke `index` is drawn, given overall progress.
    ///
    /// Weighted by each stroke's own measured length so the pen keeps one
    /// speed across strokes that differ in size by more than twenty times
    /// -- a plain per-stroke share would race through the long ones and
    /// crawl on the short.
    private func drawn(_ index: Int) -> Double {
        let lengths = strokes.map(\.length)
        let total = lengths.reduce(0, +)
        guard total > 0 else { return progress }
        let before = lengths.prefix(index).reduce(0, +) / total
        let share = lengths[index] / total
        return min(1, max(0, (progress - before) / share))
    }
}

/**
 Trifecta's coin-result grid.

 The same 4x4 skeleton, display order and narrowing as the Teamwork
 grid's, with two additions:

 1. **A cell can hold one or two symbols**, and that count *is* its
    damage -- so a two-symbol cell draws both, a little smaller.
 2. **The tile spans two cells.** Rather than teaching the grid about
    spanning, the cells it covers render empty and the tile is an overlay
    on top of them -- which is also how the Figma composites it. Its
    position comes from wherever the arrangement actually put it rather
    than from per-Sheet config: the two cells are always side by side
    across the centre line, so the minimum and maximum of their columns is
    the whole calculation.

 Deliberately not folded in with the Teamwork grid yet, even though the
 skeleton and labels are near-identical. The grid-flexibility pass wants
 more than one custom-cell Family to design against -- generalising off a
 single case is the mistake avoided by building Rooftop before
 generalising the Teamwork engine. The duplication is known and
 temporary.
 */
private struct TrifectaGrid: View {
    let config: TrifectaSheetConfig
    let art: TrifectaSheetArt
    let activated: [String]
    let revealed: [CoinFace?]

    private var roundFullyResolved: Bool { revealed.count >= 4 }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                VStack(spacing: 0) {
                    ForEach(0..<4, id: \.self) { row in
                        HStack(spacing: 0) {
                            ForEach(0..<4, id: \.self) { column in
                                cell(row: row, column: column)
                            }
                        }
                    }
                }

                if let tile = tilePlacement() {
                    TrifectaTile(
                        elements: config.elements,
                        activated: activated,
                        art: art,
                        possible: tile.possible,
                        size: geo.size,
                        row: tile.row,
                        firstColumn: tile.firstColumn,
                        columnSpan: tile.columnSpan
                    )
                }

                ForEach(Array(SymbolGridMath.displayOrder.enumerated()), id: \.offset) { i, pairIndex in
                    label(pairIndex: pairIndex, at: i, in: geo.size)
                }
            }
            .overlay(Rectangle().stroke(Palette.fg, lineWidth: 2))
        }
    }

    private func pairAndSide(row: Int, column: Int) -> (pairIndex: Int, side: String) {
        let pairColumn = column / 2
        return (SymbolGridMath.displayOrder[pairColumn * 4 + row], column % 2 == 0 ? "o" : "x")
    }

    /// Where the tile sits, found by looking for the cells that point at
    /// it rather than being told.
    private func tilePlacement() -> (row: Int, firstColumn: Int, columnSpan: Int, possible: Bool)? {
        var found: [(row: Int, column: Int, possible: Bool)] = []
        for row in 0..<4 {
            for column in 0..<4 {
                let (pairIndex, side) = pairAndSide(row: row, column: column)
                guard config.cell(pairIndex: pairIndex, side: side)?.isTile == true else { continue }
                found.append((
                    row, column,
                    SymbolGridMath.isPossible(pairIndex: pairIndex, side: side, revealed: revealed)
                ))
            }
        }
        guard let first = found.first else { return nil }
        let columns = found.map(\.column)
        return (
            first.row,
            columns.min()!,
            columns.max()! - columns.min()! + 1,
            // Its two cells belong to two different pairs, so the tile
            // stays in play as long as either of them does.
            found.contains { $0.possible }
        )
    }

    @ViewBuilder
    private func cell(row: Int, column: Int) -> some View {
        let (pairIndex, side) = pairAndSide(row: row, column: column)
        let possible = SymbolGridMath.isPossible(pairIndex: pairIndex, side: side, revealed: revealed)
        let cell = config.cell(pairIndex: pairIndex, side: side)

        HStack(spacing: 2) {
            ForEach(Array((cell?.symbols ?? []).enumerated()), id: \.offset) { _, icon in
                if let asset = art.iconImage[icon] {
                    Image(asset)
                        .resizable()
                        .renderingMode(.template)
                        .aspectRatio(contentMode: .fit)
                        .foregroundStyle(possible ? Palette.fg : Palette.fg.opacity(0.25))
                        .animation(.easeInOut(duration: 0.3), value: possible)
                }
            }
        }
        .padding(cell?.symbols.count ?? 0 > 1 ? 4 : 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay(alignment: .trailing) {
            if column != 3 { Rectangle().fill(Palette.fg).frame(width: 1) }
        }
        .overlay(alignment: .bottom) {
            if row != 3 { Rectangle().fill(Palette.fg).frame(height: 1) }
        }
    }

    @ViewBuilder
    private func label(pairIndex: Int, at displayIndex: Int, in size: CGSize) -> some View {
        let pairColumn = displayIndex / 4
        let pairRow = displayIndex % 4
        let active = !roundFullyResolved
            && (SymbolGridMath.isPossible(pairIndex: pairIndex, side: "o", revealed: revealed)
                || SymbolGridMath.isPossible(pairIndex: pairIndex, side: "x", revealed: revealed))

        Text(SymbolGridMath.label(forPair: pairIndex))
            .font(.system(size: max(7, size.height * 0.055)).weight(.semibold))
            .tracking(1)
            .foregroundStyle(active ? Palette.fg : Palette.fg.opacity(0.3))
            .animation(.easeInOut(duration: 0.3), value: active)
            .padding(.horizontal, 3)
            .background(Palette.bg)
            .position(
                x: Double(pairColumn * 2 + 1) * size.width / 4,
                y: (Double(pairRow) + 0.5) * size.height / 4
            )
    }
}

/// The tile: the Trifecta side's three elements, lit as each shows up.
/// The number lit is exactly what a hit on it is worth, so it visibly
/// charges over a Night.
private struct TrifectaTile: View {
    let elements: [String]
    let activated: [String]
    let art: TrifectaSheetArt
    let possible: Bool
    let size: CGSize
    let row: Int
    let firstColumn: Int
    let columnSpan: Int

    var body: some View {
        HStack(spacing: 3) {
            ForEach(elements, id: \.self) { element in
                let lit = activated.contains(element)
                ZStack {
                    if let asset = art.iconImage[element] {
                        Image(asset)
                            .resizable()
                            .renderingMode(.template)
                            .aspectRatio(contentMode: .fit)
                            .foregroundStyle(possible && lit ? Palette.fg : Palette.fg.opacity(0.25))
                    }
                }
                .padding(1)
                .overlay(
                    Circle().stroke(lit ? Palette.fg : .clear, lineWidth: 1)
                )
                .animation(.easeInOut(duration: 0.3), value: lit)
            }
        }
        .padding(3)
        .frame(
            width: size.width / 4 * Double(columnSpan) - 6,
            height: size.height / 4 - 6
        )
        .background(Palette.bg)
        .overlay(
            RoundedRectangle(cornerRadius: 4)
                .stroke(possible ? Palette.fg : Palette.fg.opacity(0.25), lineWidth: 2)
        )
        .position(
            x: (Double(firstColumn) + Double(columnSpan) / 2) * size.width / 4,
            y: (Double(row) + 0.5) * size.height / 4
        )
    }
}
