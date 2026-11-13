import Foundation

/**
 The Season ring and the all-time record ledger, as `/recent` serves them.

 ## Why this one decodes rather than asking the server to render

 The away digest deliberately holds no model and no copy: the coordinator
 decides what mattered and hands back finished sentences, because what
 counts as news is a rate table and a set of judgements that must exist
 in exactly one place. See `AwayDigestStore`.

 This is the other register, and it earns a different answer. A digest
 *narrates* -- it has to read as prose, so it needs the voice that lives
 in `digestCopy.ts`. A history screen *refers*: it is a table of marks
 and results to be scanned, not read. Nothing here weighs anything or
 decides what is interesting; the screen shows every record and every
 Season the ring kept, in order, and lets the reader do the deciding.

 So the only logic below is arithmetic over data that is already on the
 wire -- who won a Season is the last Week in the list, a sweep is a
 tally with a zero in it. That is derivation, not judgement, and the line
 between them is the one worth holding: a rate, a weight, a floor or a
 gate belongs to `shared/`, while reading a fact off an array does not.
 */

struct SeasonSummary: Decodable, Identifiable {
    let seasonNumber: Int
    /// Only the order is stored; everything else derives from it.
    let weeks: [Side]
    let weeksPerSeason: Int
    /// Epoch milliseconds.
    let endedAt: Double
    let record: ContainerScore
    let streak: SeasonStreak
    /// Records broken as this Season closed, already filtered by the
    /// coordinator to the ones that survived a Season (see
    /// `notableBreaks`). Absent on Seasons that broke nothing.
    let records: [RecordBreak]?

    var id: Int { seasonNumber }

    var endedOn: Date { Date(timeIntervalSince1970: endedAt / 1000) }

    /// Who took it -- the side that won the last Week, since a Season
    /// ends the moment one side reaches the brink.
    var winner: Side? { weeks.last }

    /// The Week tally, which the wire does not carry because it is
    /// implied by the order.
    var weekTally: ContainerScore {
        ContainerScore(
            humans: weeks.filter { $0 == .humans }.count,
            demons: weeks.filter { $0 == .demons }.count
        )
    }

    /// Taken without conceding a Week.
    var wasSweep: Bool {
        let tally = weekTally
        return !weeks.isEmpty && min(tally.humans, tally.demons) == 0
    }

    /// Went to the last Week available -- a decider.
    var wentTheDistance: Bool { weeks.count >= weeksPerSeason }
}

struct SeasonStreak: Decodable {
    let side: Side?
    let length: Int
}

enum RecordId: String, Decodable, CaseIterable {
    case seasonRun = "season_run"
    case lead
    case reign

    /// What the record is *of*. A UI label rather than game copy --
    /// `digestCopy.ts` owns how a record reads in a sentence; this is the
    /// heading on a row.
    var title: String {
        switch self {
        case .seasonRun: return "Longest Season run"
        case .lead: return "Biggest all-time lead"
        case .reign: return "Longest reign in front"
        }
    }

    /// The unit, for the line under the number.
    func unit(_ value: Int) -> String {
        switch self {
        case .seasonRun: return value == 1 ? "Season" : "Seasons in a row"
        case .lead: return value == 1 ? "Season ahead" : "Seasons ahead"
        case .reign: return value == 1 ? "Season in front" : "Seasons in front"
        }
    }
}

struct RecordMark: Decodable {
    let value: Int
    /// The Season it was set in. Also what dates it.
    let seasonNumber: Int
    let at: Double

    var setOn: Date { Date(timeIntervalSince1970: at / 1000) }
}

struct SideMarks: Decodable {
    let humans: RecordMark?
    let demons: RecordMark?
}

struct RecordBreak: Decodable {
    let id: RecordId
    let side: Side
    let value: Int
    let previous: Int?
    /// Seasons the beaten mark stood.
    let stood: Int
    let weight: Double
}

struct RecordLedger: Decodable {
    struct Since: Decodable {
        let seasonNumber: Int
        let at: Double
    }

    /// Who currently holds the all-time lead and the Season their reign
    /// began.
    ///
    /// Not a `SeasonStreak`, which is the mistake this was written as the
    /// first time: both carry a `side`, but a streak counts a `length`
    /// while this records the Season it started from, and the reign's
    /// length is the distance from there to now. Decoding one as the
    /// other fails on the missing key and takes the whole screen with it.
    struct Reign: Decodable {
        let side: Side?
        let since: Int
    }

    /// Where the ledger's claims begin, and the honest part of the
    /// screen. This shipped onto a channel already twelve hundred Seasons
    /// old and nothing can recover what came before, so "all-time" means
    /// "since this Season" and the screen says so out loud.
    let since: Since
    let marks: [String: SideMarks]
    let reign: Reign

    func marks(for id: RecordId) -> SideMarks? { marks[id.rawValue] }

    /**
     Where a record stands.

     Three states, not two, and the third is why this is an enum rather
     than an optional holder. `recordHolder()` in `records.ts` returns
     null both when a record has never been set and when the two sides
     are level on it, which is right for the digest — neither is a
     headline. On a record book it throws away the better answer: both
     sides being on five is not "no record", it is a shared one, and the
     screen has both marks in hand to say so.

     Joshua's call that a record is tracked per side but shown for the
     leader still holds. This only adds the case where there is no
     leader to show.
     */
    enum Standing {
        case held(side: Side, mark: RecordMark)
        /// Both sides on the same mark. Carries the more recent of the
        /// two, since "level at 5, last reached in Season 1,274" is the
        /// useful reading.
        case level(value: Int, mark: RecordMark)
        case unset
    }

    func standing(of id: RecordId) -> Standing {
        guard let both = marks(for: id) else { return .unset }
        switch (both.humans, both.demons) {
        case let (humans?, demons?):
            if humans.value == demons.value {
                let latest = humans.seasonNumber >= demons.seasonNumber ? humans : demons
                return .level(value: humans.value, mark: latest)
            }
            return humans.value > demons.value
                ? .held(side: .humans, mark: humans)
                : .held(side: .demons, mark: demons)
        case let (humans?, nil):
            return .held(side: .humans, mark: humans)
        case let (nil, demons?):
            return .held(side: .demons, mark: demons)
        case (nil, nil):
            return .unset
        }
    }
}

/// What `GET /channels/:id/recent` answers with.
struct ChannelHistory: Decodable {
    /// Oldest first, matching the ring itself.
    let seasons: [SeasonSummary]
    let records: RecordLedger
}
