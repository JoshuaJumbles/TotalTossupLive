import Foundation

/// The coordinator's broadcast, as much of it as this build understands.
///
/// Only the fields the spike renders are declared. That is deliberate and
/// not laziness: a shipped app meets snapshots written by a newer server,
/// and `Decodable` ignores keys it wasn't told about, so decoding the
/// subset we understand is what keeps an old build working against a new
/// coordinator. The parts left out -- `nightState`, `sheetConfig`,
/// `unitCrossOrder` -- are the Family-specific shapes, which is exactly
/// where a future server will add things.
struct ChannelSnapshot: Decodable {
    let channelId: String

    let phase: GamePhase
    /// Epoch milliseconds, as the wire sends them. Every bit of timing in
    /// the app is derived from these two numbers plus the local clock --
    /// the same contract the web client renders under, and the reason a
    /// widget can predict the whole schedule from one fetch.
    let phaseStartedAt: Double
    let phaseEndsAt: Double

    let seasonNumber: Int
    let weekNumber: Int
    let nightNumber: Int
    let nightsPerWeek: Int
    let weeksPerSeason: Int
    let completedWeeks: [WeekResult]

    let sheetId: String
    let familyId: String
    let sheetStyle: String

    let weekScore: ContainerScore
    let seasonScore: ContainerScore
    let lifetimeRecord: ContainerScore

    /// Which unit each side loses next, decided once per Night by the
    /// coordinator and persisted. The renderer never chooses -- it reads
    /// the first N of this list, where N is how many rounds that side has
    /// lost, so every viewer crosses off the same figures.
    let unitCrossOrder: SideOrder

    /// Decoded only when this build recognises the Family. A Sheet from a
    /// Family we don't know yet leaves these nil and the app falls back to
    /// the plain scoreboard rather than failing to decode at all.
    let bestOfNight: BestOfNightState?
    let bestOfSheet: BestOfSheetConfig?

    private enum CodingKeys: String, CodingKey {
        case channelId, phase, phaseStartedAt, phaseEndsAt
        case seasonNumber, weekNumber, nightNumber, nightsPerWeek, weeksPerSeason
        case completedWeeks, sheetId, familyId, sheetStyle
        case weekScore, seasonScore, lifetimeRecord
        case unitCrossOrder, nightState, sheetConfig
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        channelId = try c.decode(String.self, forKey: .channelId)
        phase = try c.decode(GamePhase.self, forKey: .phase)
        phaseStartedAt = try c.decode(Double.self, forKey: .phaseStartedAt)
        phaseEndsAt = try c.decode(Double.self, forKey: .phaseEndsAt)
        seasonNumber = try c.decode(Int.self, forKey: .seasonNumber)
        weekNumber = try c.decode(Int.self, forKey: .weekNumber)
        nightNumber = try c.decode(Int.self, forKey: .nightNumber)
        nightsPerWeek = try c.decode(Int.self, forKey: .nightsPerWeek)
        weeksPerSeason = try c.decode(Int.self, forKey: .weeksPerSeason)
        completedWeeks = try c.decode([WeekResult].self, forKey: .completedWeeks)
        sheetId = try c.decode(String.self, forKey: .sheetId)
        familyId = try c.decode(String.self, forKey: .familyId)
        sheetStyle = try c.decode(String.self, forKey: .sheetStyle)
        weekScore = try c.decode(ContainerScore.self, forKey: .weekScore)
        seasonScore = try c.decode(ContainerScore.self, forKey: .seasonScore)
        lifetimeRecord = try c.decode(ContainerScore.self, forKey: .lifetimeRecord)
        unitCrossOrder = try c.decode(SideOrder.self, forKey: .unitCrossOrder)

        // `try?` on purpose. A Family-shaped payload that has grown a field
        // this build doesn't know should cost us that Sheet's art, not the
        // whole connection.
        let isBestOf = familyId == "bestof"
        bestOfNight = isBestOf ? try? c.decode(BestOfNightState.self, forKey: .nightState) : nil
        bestOfSheet = isBestOf ? try? c.decode(BestOfSheetConfig.self, forKey: .sheetConfig) : nil
    }

    var phaseStart: Date { Date(timeIntervalSince1970: phaseStartedAt / 1000) }
    var phaseEnd: Date { Date(timeIntervalSince1970: phaseEndsAt / 1000) }

    /// How far through the current phase we are, by the local clock.
    func progress(at now: Date = .now) -> Double {
        let total = phaseEnd.timeIntervalSince(phaseStart)
        guard total > 0 else { return 1 }
        return min(1, max(0, now.timeIntervalSince(phaseStart) / total))
    }

    func remaining(at now: Date = .now) -> TimeInterval {
        max(0, phaseEnd.timeIntervalSince(now))
    }
}

struct ContainerScore: Decodable {
    let humans: Int
    let demons: Int
}

struct WeekResult: Decodable {
    let weekNumber: Int
    let winner: Side?
}

enum Side: String, Decodable {
    case humans, demons
}

/// Phases, with an `unknown` case rather than a decode failure.
///
/// Same reasoning as the snapshot above: the server can grow a phase this
/// build has never heard of, and the right response is to show something
/// sensible rather than drop the connection.
enum GamePhase: String, Decodable {
    case standby
    case seasonLaunch = "season_launch"
    case seasonOverview = "season_overview"
    case flipping
    case roundResolved = "round_resolved"
    case nightWon = "night_won"
    case weekWon = "week_won"
    case seasonWon = "season_won"
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = GamePhase(rawValue: raw) ?? .unknown
    }

    var label: String {
        switch self {
        case .standby: return "Standby"
        case .seasonLaunch: return "Season starting"
        case .seasonOverview: return "Season overview"
        case .flipping: return "Flipping"
        case .roundResolved: return "Round resolved"
        case .nightWon: return "Night won"
        case .weekWon: return "Week won"
        case .seasonWon: return "Season won"
        case .unknown: return "In progress"
        }
    }
}

struct SideOrder: Decodable {
    let humans: [Int]
    let demons: [Int]

    subscript(side: Side) -> [Int] {
        side == .humans ? humans : demons
    }
}

/// The Battle Family: a race to `targetRoundPoints` round wins, with one
/// unit crossed off the loser's line each time a round goes against them.
struct BestOfNightState: Decodable {
    let roundPoints: ContainerScore
    let currentRound: BestOfRoundState
    let completedRounds: Int
}

struct BestOfRoundState: Decodable {
    let roundIndex: Int
    let flips: [Flip]
    let flipWins: ContainerScore
}

struct BestOfSheetConfig: Decodable {
    let roundSize: Int
    let roundWinThreshold: Int
    /// Also the unit count per side -- the figures on a Battle Sheet are
    /// the race target drawn out.
    let targetRoundPoints: Int
}

struct Flip: Decodable {
    let sequenceIndex: Int
    let face: CoinFace?
    let winner: Side?
}

enum CoinFace: String, Decodable {
    case heads, tails

    var letter: String { self == .heads ? "H" : "T" }
}

extension Side {
    var other: Side { self == .humans ? .demons : .humans }
}
