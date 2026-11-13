import Foundation

/**
 The Teamwork Family, as the coordinator broadcasts it.

 Six Sheets share one engine and, here, one renderer: Barricade,
 CloudFight, Inferno, RiverShark, Portal and Rooftop. Nothing below
 branches per Sheet, and that is the whole reason all six could land at
 once -- the differences between them live in the *engine*, which is
 server-side and already done, and in each Sheet's art, which is data.

 ## What a Teamwork Night is

 Each side has an `action` track and, on most Sheets, a `defense` track.
 Four flips address one of sixteen grid cells, that cell names an icon,
 and the icon's track gains a mark. A side wins by reaching its action
 target -- which the *other* side's defense pushes further away as it
 fills -- or by completing its own defense outright.

 The renderer needs none of that arithmetic. It needs only where each
 mark goes, and a mark's position in its track array is its position on
 the bar. That one rule is what makes CloudFight's jetpack/bow "handoff"
 fall out for free: both icons feed one track, so a mark's index is its
 global position while its icon decides which lane it is drawn in.
 */

/// One track's marks this Night, in order. Entry i is the icon that
/// claimed that track's (i+1)th slot.
typealias TeamworkTrackMarks = [String]

struct TeamworkSideState: Decodable {
    let action: TeamworkTrackMarks
    /// Always a real array even for a side whose Sheet has no defense
    /// track, so nothing here has to null-check it.
    let defense: TeamworkTrackMarks
}

struct TeamworkNightState: Decodable {
    struct Round: Decodable {
        let roundIndex: Int
        let flips: [Flip]
    }

    /// Grows to exactly 4 per round -- Teamwork's round size is fixed by
    /// the grid's own 4-bit address space, not a config knob.
    let currentRound: Round
    let humans: TeamworkSideState
    let demons: TeamworkSideState
}

/// Which icon sits on each grid pair's O and X side. Real game config,
/// broadcast with the snapshot, so the art files keep no copy of it.
struct TeamworkPair: Decodable {
    let o: String
    let x: String
}

struct TeamworkSheetConfig: Decodable {
    /// Keyed by pair index as a string, because JSON object keys are
    /// strings even when the server's type says `Record<number, …>`.
    let arrangement: [String: TeamworkPair]

    func pair(_ index: Int) -> TeamworkPair? { arrangement[String(index)] }
}

/**
 Which grid cell four flips address.

 Ported rather than fetched: this is three bits and a parity bit, the
 coordinator computes it the same way, and both clients have to agree or
 they would draw different Nights. Mirrors `resolveGridCell` in
 shared/src/symbolGrid.ts.
 */
enum SymbolGridMath {
    static func resolve(_ faces: [CoinFace]) -> (pairIndex: Int, side: String)? {
        guard faces.count == 4 else { return nil }
        let bits = (faces[0] == .heads ? 4 : 0) + (faces[1] == .heads ? 2 : 0) + (faces[2] == .heads ? 1 : 0)
        return (bits, faces[3] == .heads ? "x" : "o")
    }

    /**
     Whether a cell is still a reachable outcome given the flips so far.

     This is the narrowing a live viewer watches happen: before the first
     flip every cell is possible, and exactly one survives all four. A
     flip that has not landed yet rules nothing out. Mirrors
     `cellIsPossible` in shared/src/symbolGrid.ts.
     */
    static func isPossible(pairIndex: Int, side: String, revealed: [CoinFace?]) -> Bool {
        let implied = [
            pairIndex & 4 != 0,
            pairIndex & 2 != 0,
            pairIndex & 1 != 0,
            side == "x",
        ]
        for (i, expectHeads) in implied.enumerated() {
            guard i < revealed.count, let face = revealed[i] else { continue }
            if (face == .heads) != expectHeads { return false }
        }
        return true
    }
}
