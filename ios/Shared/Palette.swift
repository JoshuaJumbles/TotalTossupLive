import SwiftUI

/// The game's own five tokens, matching web/src/lib/colorSchemes.ts's
/// Classic scheme. Kept as one small surface so the Midnight scheme (and
/// whatever a cosmetic shop sells later) has an obvious place to live.
enum Palette {
    static let bg = Color(red: 1, green: 1, blue: 1)
    static let fg = Color(red: 0, green: 0, blue: 0)
    static let humans = Color(red: 0x72 / 255, green: 0xa3 / 255, blue: 1)
    static let demons = Color(red: 1, green: 0x54 / 255, blue: 0x54 / 255)
    static let card = Color(red: 0xe6 / 255, green: 0xe6 / 255, blue: 0xe6 / 255)

    /// Unit art is drawn from a fill/line pair rather than one picture, so
    /// each layer gets its own colour. In Classic both sides are a white
    /// figure with black linework; the side colours above are for the
    /// marks, not the figures.
    static let unitFill = Color.white
    static let unitLine = Color.black

    static func side(_ side: Side) -> Color {
        side == .humans ? humans : demons
    }
}
