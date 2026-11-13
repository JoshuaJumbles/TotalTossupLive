import SwiftUI

/**
 Every Teamwork Sheet, drawn by one view.

 Six Sheets, one renderer, and nothing in here branches on which Sheet it
 is. That is not a tidiness claim -- it is why all six could land
 together. What differs between Barricade and Rooftop is the *engine*
 (how a defense track pushes an action target, what a fractional push
 value does), and that is server-side and finished. What reaches a client
 is four arrays of icon names, and the rule for drawing them is the same
 on every Sheet:

     a mark's index in its track is its position on that icon's bar.

 That one rule is what makes the split tracks work for free. CloudFight's
 humans feed one action score from two icons; the track reads
 `["bow", "jetpack", "bow", ...]`, and mapping each entry by its index in
 *that* array -- not by a per-icon count -- lands every mark on the right
 global position while its icon picks the lane it is drawn in. Rooftop's
 spear/guns and Portal's bat/chain are the same mechanic.

 ## The frame

 Positions are pixels in a 409x311 scene, so the view locks to that
 aspect and converts to fractions. Hold the ratio and every mark is
 correct at any width with no further arithmetic; lose it and all of them
 are subtly wrong. The grid below adds another 166 units of the same
 scale.
 */
private let sceneWidth: Double = 409
private let sceneHeight: Double = 311
private let gridHeight: Double = 166

struct TeamworkSheet: View {
    let snapshot: ChannelSnapshot
    let night: TeamworkNightState
    let config: TeamworkSheetConfig
    let art: TeamworkSheetArt

    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { geo in
                let scale = geo.size.width / sceneWidth
                ZStack(alignment: .topLeading) {
                    // Line-only art, drawn as a template over the scheme's
                    // foreground rather than used as a picture -- the same
                    // technique the units use, and what lets a palette
                    // change recolour the scene.
                    Image(art.sceneImage)
                        .resizable()
                        .renderingMode(.template)
                        .foregroundStyle(Palette.fg)
                        .frame(width: geo.size.width, height: geo.size.width * sceneHeight / sceneWidth)

                    marks(scale: scale)

                    Text("NIGHT \(snapshot.nightNumber)")
                        .font(.system(size: 24 * scale, design: .rounded).weight(.black))
                        .foregroundStyle(Palette.fg)
                        .offset(
                            x: art.labelLeft * geo.size.width,
                            y: art.labelTop * geo.size.width * sceneHeight / sceneWidth
                        )
                }
                .frame(width: geo.size.width, height: geo.size.width * sceneHeight / sceneWidth)
                .overlay(Rectangle().stroke(Palette.fg, lineWidth: 3))
            }
            .aspectRatio(sceneWidth / sceneHeight, contentMode: .fit)

            SymbolGrid(config: config, art: art, revealed: revealedFaces)
                .aspectRatio(sceneWidth / gridHeight, contentMode: .fit)
        }
    }

    private var revealedFaces: [CoinFace?] {
        night.currentRound.flips.map(\.face)
    }

    /// The icon this round landed on, once all four flips have shown and
    /// the coordinator is in its round_resolved pause.
    ///
    /// Derived here rather than broadcast: every input is already in the
    /// snapshot, and the coordinator computes it from the same four bits
    /// (see SymbolGridMath). Only the one mark it names plays the reveal;
    /// everything else, including this same mark on every later render,
    /// is a settled strikethrough.
    private var justResolvedIcon: String? {
        guard snapshot.phase == .roundResolved else { return nil }
        let faces = revealedFaces.compactMap { $0 }
        guard faces.count == 4, let cell = SymbolGridMath.resolve(faces) else { return nil }
        guard let pair = config.pair(cell.pairIndex) else { return nil }
        return cell.side == "x" ? pair.x : pair.o
    }

    @ViewBuilder
    private func marks(scale: Double) -> some View {
        // Four tracks, each independent: a track's marks land on its own
        // icons' cells regardless of what the other three hold.
        let tracks = [night.humans.action, night.humans.defense, night.demons.action, night.demons.defense]
        let resolved = justResolvedIcon

        ForEach(Array(tracks.enumerated()), id: \.offset) { _, marks in
            ForEach(Array(marks.enumerated()), id: \.offset) { index, icon in
                if let bar = art.bars[icon], index < bar.cells.count {
                    let cell = bar.cells[index]
                    MarkCell(
                        cell: cell,
                        scale: scale,
                        side: bar.side,
                        // The newest mark on the track that just got hit
                        // is always its own array's last entry, and an
                        // icon belongs to exactly one track per Sheet, so
                        // no separate lookup is needed.
                        isNew: icon == resolved && index == marks.count - 1,
                        phaseDuration: snapshot.phaseEnd.timeIntervalSince(snapshot.phaseStart)
                    )
                }
                // A track can out-run its own drawn cells -- a target
                // pushed further than the bar's art anticipated -- so an
                // index past the end draws nothing rather than crashing.
            }
        }
    }
}

/// One mark, at one cell.
private struct MarkCell: View {
    let cell: BarCell
    let scale: Double
    let side: Side
    let isNew: Bool
    let phaseDuration: TimeInterval

    @State private var drawn: Double = 0

    var body: some View {
        Image("strikethrough-ink")
            .resizable()
            .renderingMode(.template)
            .foregroundStyle(Palette.side(side))
            .frame(width: cell.size * scale, height: cell.size * scale)
            .mask(alignment: .top) {
                GeometryReader { geo in
                    Rectangle().frame(height: geo.size.height * drawn)
                }
            }
            .offset(x: cell.left * scale, y: cell.top * scale)
            .onAppear {
                guard isNew, phaseDuration > 0 else {
                    drawn = 1
                    return
                }
                // The one mark landing now draws itself over the pause it
                // landed in, ending exactly where a settled mark sits --
                // same asset, same tint, so there is no seam.
                withAnimation(.easeOut(duration: min(phaseDuration, 0.6))) { drawn = 1 }
            }
    }
}

/**
 The sixteen cells four flips address, and which of them are still live.

 Eight pairs, each with an O and an X side. Three flips pick the pair and
 the fourth picks the side, so after each flip some cells stop being
 reachable -- the narrowing a viewer watches happen. A cell that can no
 longer be the answer is dimmed rather than removed, because the shape of
 the grid is part of reading it.
 */
private struct SymbolGrid: View {
    let config: TeamworkSheetConfig
    let art: TeamworkSheetArt
    let revealed: [CoinFace?]

    var body: some View {
        GeometryReader { geo in
            let cellWidth = geo.size.width / 8
            HStack(spacing: 0) {
                ForEach(0..<8, id: \.self) { pairIndex in
                    VStack(spacing: 0) {
                        cell(pairIndex: pairIndex, side: "o")
                        cell(pairIndex: pairIndex, side: "x")
                    }
                    .frame(width: cellWidth)
                }
            }
            .overlay(Rectangle().stroke(Palette.fg, lineWidth: 3))
        }
    }

    @ViewBuilder
    private func cell(pairIndex: Int, side: String) -> some View {
        let possible = SymbolGridMath.isPossible(pairIndex: pairIndex, side: side, revealed: revealed)
        let icon = config.pair(pairIndex).map { side == "x" ? $0.x : $0.o }

        ZStack {
            if let icon, let asset = art.iconImage[icon] {
                Image(asset)
                    .resizable()
                    .renderingMode(.template)
                    .aspectRatio(contentMode: .fit)
                    .foregroundStyle(Palette.fg)
                    .padding(3)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .opacity(possible ? 1 : 0.15)
        .overlay(Rectangle().stroke(Palette.fg.opacity(0.4), lineWidth: 1))
    }
}
