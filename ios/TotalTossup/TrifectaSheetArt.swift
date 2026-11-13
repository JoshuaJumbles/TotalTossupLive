import SwiftUI

/**
 Each Trifecta Sheet's art.

 Much thinner than the Teamwork equivalent, and for a reason worth
 naming: a Teamwork Sheet needs a geometry table because its marks are a
 stock strikethrough placed at authored cells, so the positions have to
 live somewhere. A Trifecta mark carries its own position in its path
 data -- Joshua draws the nine marks laid out in place over the scene --
 so there is nothing here but the scene, the icons and where the Night
 label sits.

 The paths themselves are generated into TrifectaMarkArt.swift by
 ios/scripts/mark-paths-to-swift.mjs rather than written here.
 */
struct TrifectaSheetArt {
    let sceneImage: String
    /// Icon key to asset name, prefixed per Sheet -- `guns` exists in
    /// both Rooftop and Ambush, and `demonface` in two Trifecta Sheets.
    let iconImage: [String: String]
    let labelLeft: Double
    let labelTop: Double
}

enum TrifectaArt {
    /// By `sheetStyle`, which is what the snapshot carries.
    static func forStyle(_ style: String) -> TrifectaSheetArt? { all[style] }

    static let all: [String: TrifectaSheetArt] = [
        // Icon keys taken from each Sheet's own icon type in
        // shared/src/family.ts, not from the asset filenames -- they
        // happen to agree, and the type is what the wire actually sends.
        "nightmare": sheet("nightmare", ["star", "scream", "hand", "demon"]),
        "demonking": sheet("demonking", ["demonface", "bow", "swords", "fork"]),
        "kinghuman": sheet("kinghuman", ["triking", "bigflyer", "axe", "spitter"]),
        "ambush": sheet("ambush", ["demonface", "hammer", "guns", "shotgun"]),
        "bombsquad": sheet("bombsquad", ["bomb", "small", "medium", "large"]),
        "tentaclepit": sheet("tentaclepit", ["demonface", "drill", "claw", "gun"]),
    ]

    /// Every Sheet's assets follow the same naming, so the table only has
    /// to name the icons each one actually uses.
    private static func sheet(_ style: String, _ icons: [String]) -> TrifectaSheetArt {
        TrifectaSheetArt(
            sceneImage: "\(style)-scene",
            iconImage: Dictionary(uniqueKeysWithValues: icons.map { ($0, "\(style)-\($0)") }),
            labelLeft: 0.05,
            labelTop: 0.02
        )
    }
}
