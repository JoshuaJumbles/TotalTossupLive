import Foundation

/**
 What there is to connect to, as `GET /channels` serves it.

 The list is derived on the server from the presets themselves rather
 than written down twice (see `channelDirectory()` in presets.ts), which
 matters more than it looks: the only previous list of channel ids was
 the if-chain inside `presetFor`, and a second copy on this side would
 eventually lose a Family. The symptom would be a channel that works
 perfectly and is simply invisible to the app.
 */
struct ChannelListing: Decodable, Identifiable {
    let id: String
    /// Every Family this channel's rotation draws on. Usually one.
    let familyIds: [String]
    /// Distinct visual styles in the rotation -- what a renderer has to
    /// know how to draw before this channel looks like anything.
    let styles: [String]
    let nightsPerWeek: Int
    let weeksPerSeason: Int
    /// false means the channel is asleep until someone posts /start.
    let autoStart: Bool

    /// Whether this build can draw the channel's Sheets, or will fall
    /// back to the plain scoreboard.
    ///
    /// Honest rather than flattering, and it is the reason the picker is
    /// worth building before any new renderer: the app can already
    /// *connect* to all eleven channels and render their scores, phases
    /// and timing correctly, because ChannelSnapshot decodes
    /// Family-specific state only for the Families it knows and falls
    /// through to the scoreboard otherwise. Saying which is which turns
    /// that from a silent gap into a visible to-do list.
    var hasRenderer: Bool {
        styles.allSatisfy { Self.drawableStyles.contains($0) }
    }

    /// The styles with a renderer in this build. One entry today;
    /// BattleSheet is the only Sheet art that exists.
    static let drawableStyles: Set<String> = ["battle"]

    var containerShape: String { "\(nightsPerWeek)/\(weeksPerSeason)" }
}

struct ChannelDirectory: Decodable {
    let channels: [ChannelListing]
}
