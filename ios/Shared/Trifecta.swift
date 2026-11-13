import Foundation

/**
 The Trifecta Family, as the coordinator broadcasts it.

 Six Sheets: Nightmare, Demon King, King Human, Ambush, Bomb Squad and
 Tentacle Pit. Same 4x4 coin grid as Teamwork underneath, and two things
 of its own.

 **One side fields variety, the other is uniform.** Which is which is
 config, not art: King Human puts the humans in a single uniform giant
 and the demons in three forces, Ambush flips it. `trifectaSide` says
 who holds the three elements and the tile; the other side gets
 `uniformIcon`.

 **The Trifecta tile charges over a Night.** It holds no symbols of its
 own and is worth one damage per element that has shown up so far -- zero
 at the top of a Night, three once all three have appeared. Two grid
 cells point at it, straddling the board's centre line, which is all that
 makes it "double-wide" as far as the engine is concerned.

 Nine targets a side, and losing all nine loses the Night.
 */

/// One grid cell: either symbols that deal a damage each, or the tile.
enum TrifectaCell: Decodable {
    case symbols([String])
    case trifecta

    private enum CodingKeys: String, CodingKey { case kind, symbols }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(String.self, forKey: .kind) {
        case "trifecta":
            self = .trifecta
        case "symbols":
            self = .symbols(try c.decode([String].self, forKey: .symbols))
        case let other:
            throw DecodingError.dataCorruptedError(
                forKey: .kind, in: c,
                debugDescription: "unknown Trifecta cell kind \"\(other)\""
            )
        }
    }

    var symbols: [String] {
        if case let .symbols(icons) = self { return icons }
        return []
    }

    var isTile: Bool {
        if case .trifecta = self { return true }
        return false
    }
}

struct TrifectaPair: Decodable {
    let o: TrifectaCell
    let x: TrifectaCell
}

struct TrifectaSheetConfig: Decodable {
    /// Keyed by pair index as a string -- JSON object keys are strings
    /// even where the server's type reads `Record<number, …>`.
    let arrangement: [String: TrifectaPair]
    /// Which side fields the three elements and owns the tile.
    let trifectaSide: Side
    /// Those three elements, in the order the tile draws them.
    let elements: [String]
    /// The uniform side's single icon.
    let uniformIcon: String

    func pair(_ index: Int) -> TrifectaPair? { arrangement[String(index)] }

    func cell(pairIndex: Int, side: String) -> TrifectaCell? {
        guard let pair = pair(pairIndex) else { return nil }
        return side == "x" ? pair.x : pair.o
    }
}

struct TrifectaNightState: Decodable {
    struct Round: Decodable {
        let roundIndex: Int
        let flips: [Flip]
    }

    /// What the round that just closed did: which side took the damage,
    /// and exactly which of its targets went, in draw order.
    ///
    /// Broadcast rather than diffed client-side, which is the detail that
    /// makes a reconnect mid-pause work -- a client that joined during the
    /// pause has no previous snapshot to diff against. Null while a round
    /// is still running, and `targets` is empty for a round that dealt no
    /// damage at all: the unlit tile's quiet beat.
    struct LastRound: Decodable {
        let side: Side
        let targets: [Int]
    }

    let currentRound: Round
    /// Target indices in the order they were actually destroyed, not a
    /// count -- a single round can take up to three at once, and the
    /// order is what lets them be drawn in sequence.
    let destroyed: [String: [Int]]
    /// Which of the Trifecta side's elements have shown up so far. Its
    /// length is the tile's current damage.
    let activated: [String]
    let lastRound: LastRound?

    func destroyed(_ side: Side) -> [Int] {
        destroyed[side == .humans ? "humans" : "demons"] ?? []
    }
}
