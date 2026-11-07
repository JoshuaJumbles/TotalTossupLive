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
