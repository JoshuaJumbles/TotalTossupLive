import SwiftUI

/**
 Where every Teamwork Sheet's marks go.

 ## Transcribed, not re-derived

 These are real pixel positions in each Sheet's own 409x311 Figma scene
 frame, copied from the web client's `*SheetArt.ts` files rather than
 measured again. That is deliberate: the web's numbers were transcribed
 from Joshua's own reference marks and then verified live, Sheet by
 Sheet, against real play. Re-measuring from the same art would have been
 a second chance to be wrong about the same thing, and the failure mode
 is a mark landing one slot off -- which looks plausible and is not.

 The duplication is real and bounded: it is static art geometry, it
 changes only when the art does, and both copies are read-only data with
 no logic to drift. If the Sheets ever get re-cut, both move together.

 Each bar's cells are ordered nearest-to-centre first, matching how the
 bars actually fill. A negative `left` is intentional -- the final,
 uncontestable cell of several bars sits partly outside the frame.
 */

struct BarCell {
    let left: Double
    let top: Double
    let size: Double
}

/// One icon's bar: the cells it fills, and the side whose colour its
/// marks take.
struct IconBar {
    let side: Side
    let cells: [BarCell]
}

struct TeamworkSheetArt {
    /// Asset-catalog name of the line-only scene, drawn as a template so
    /// a palette change recolours it.
    let sceneImage: String
    /// Icon key to asset name. Prefixed per Sheet, because `guns` exists
    /// in both Rooftop and Ambush.
    let iconImage: [String: String]
    let bars: [String: IconBar]
    /// "Night N" placement as a fraction of the scene box. Per Sheet
    /// because it sits in whatever open space each scene happens to
    /// leave.
    let labelLeft: Double
    let labelTop: Double
}

/// Every cell on a row at the same height and size -- the common case.
private func row(_ lefts: [Double], top: Double, size: Double) -> [BarCell] {
    lefts.map { BarCell(left: $0, top: top, size: size) }
}

enum TeamworkArt {
    /// By `sheetStyle`, which is what the snapshot carries.
    static func forStyle(_ style: String) -> TeamworkSheetArt? { all[style] }

    static let all: [String: TeamworkSheetArt] = [
        "barricade": barricade,
        "cloudfight": cloudfight,
        "inferno": inferno,
        "rivershark": rivershark,
        "portal": portal,
        "rooftop": rooftop,
    ]

    /// Humans have the defense here (planks); the demons' knife runs the
    /// long bar. The 8:4:4 icon ratio three Sheets share.
    static let barricade = TeamworkSheetArt(
        sceneImage: "barricade-scene",
        iconImage: ["knife": "barricade-knife", "medkit": "barricade-medkit", "planks": "barricade-planks"],
        bars: [
            "medkit": IconBar(side: .humans, cells: row([238, 259, 281, 303, 325, 362], top: 264, size: 43)),
            "knife": IconBar(side: .demons, cells: row([136, 117, 98, 82, 64, 46, 30, 10, -11], top: 264, size: 43)),
            "planks": IconBar(side: .humans, cells: row([74, 57, 39, 21, -1], top: 213, size: 31)),
        ],
        labelLeft: 0.247,
        labelTop: 0.023
    )

    /// The first split track: jetpack and bow feed one humans action
    /// score on two lanes, so a mark's index is its global position while
    /// its icon decides the lane. Roles flipped from Barricade -- the
    /// demons hold the defense (skull).
    static let cloudfight: TeamworkSheetArt = {
        let jetpackX: [Double] = [234, 251, 269, 287, 306, 324, 342, 359, 381]
        return TeamworkSheetArt(
            sceneImage: "cloudfight-scene",
            iconImage: [
                "jetpack": "cloudfight-jetpack", "bow": "cloudfight-bow",
                "snake": "cloudfight-snake", "skull": "cloudfight-skull",
            ],
            bars: [
                "jetpack": IconBar(side: .humans, cells: row(jetpackX, top: 243, size: 34)),
                "bow": IconBar(side: .humans, cells: row(jetpackX, top: 274, size: 34)),
                "snake": IconBar(side: .demons, cells: row([123, 102, 80, 59, 37, 2], top: 261, size: 40)),
                "skull": IconBar(side: .demons, cells: row([300, 318, 337, 356, 378], top: 187, size: 30)),
            ],
            labelLeft: 0.05,
            labelTop: 0.02
        )
    }()

    /// A clean reskin of Barricade's shape: fire in 8 cells, water and
    /// shield in 4 each.
    static let inferno = TeamworkSheetArt(
        sceneImage: "inferno-scene",
        iconImage: ["fire": "inferno-fire", "water": "inferno-water", "shield": "inferno-shield"],
        bars: [
            "water": IconBar(side: .humans, cells: row([239, 261, 283, 305, 326, 360], top: 253, size: 42)),
            "fire": IconBar(side: .demons, cells: row([140, 121, 104, 87, 69, 51, 32, 14, -9], top: 256, size: 34)),
            "shield": IconBar(side: .humans, cells: row([75, 57, 38, 20, -1], top: 200, size: 32)),
        ],
        labelLeft: 0.05,
        labelTop: 0.02
    )

    /// Barricade's shape again, mirrored: the demons' shark runs left to
    /// right here rather than right to left.
    static let rivershark = TeamworkSheetArt(
        sceneImage: "rivershark-scene",
        iconImage: ["shark": "rivershark-shark", "gun": "rivershark-gun", "oar": "rivershark-oar"],
        bars: [
            "gun": IconBar(side: .humans, cells: row([129, 108, 86, 65, 43, 8], top: 266, size: 42)),
            "shark": IconBar(side: .demons, cells: row([237, 255, 273, 289, 308, 326, 345, 362, 381], top: 268, size: 36)),
            "oar": IconBar(side: .humans, cells: row([302, 320, 338, 355, 378], top: 211, size: 36)),
        ],
        labelLeft: 0.05,
        labelTop: 0.02
    )

    /// CloudFight's shape with the split side flipped: bat and chain share
    /// the demons' action track.
    static let portal: TeamworkSheetArt = {
        let batChainX: [Double] = [132, 115, 100, 85, 69, 54, 38, 21, -1]
        return TeamworkSheetArt(
            sceneImage: "portal-scene",
            iconImage: [
                "bat": "portal-bat", "chain": "portal-chain",
                "book": "portal-book", "ladder": "portal-ladder",
            ],
            bars: [
                "bat": IconBar(side: .demons, cells: row(batChainX, top: 244, size: 31)),
                "chain": IconBar(side: .demons, cells: row(batChainX, top: 275, size: 31)),
                "book": IconBar(side: .humans, cells: row([239, 261, 283, 305, 326, 360], top: 259, size: 42)),
                "ladder": IconBar(side: .humans, cells: row([75, 60, 44, 27, 6], top: 187, size: 29)),
            ],
            labelLeft: 0.05,
            labelTop: 0.02
        )
    }()

    /// The finale, and the only genuinely new shape: both sides have both
    /// tracks. Music and crystal zig-zag rather than sitting on a row,
    /// which is why their cells are written out one by one.
    static let rooftop: TeamworkSheetArt = {
        let spearGunX: [Double] = [231, 249, 267, 285, 302, 320, 338, 356, 378]
        return TeamworkSheetArt(
            sceneImage: "rooftop-scene",
            iconImage: [
                "spear": "rooftop-spear", "guns": "rooftop-guns", "music": "rooftop-music",
                "blast": "rooftop-blast", "crystal": "rooftop-crystal",
            ],
            bars: [
                "spear": IconBar(side: .humans, cells: row(spearGunX, top: 241, size: 34)),
                "guns": IconBar(side: .humans, cells: row(spearGunX, top: 269, size: 34)),
                "blast": IconBar(side: .demons, cells: row([141, 122, 105, 88, 70, 52, 33, 15, -8], top: 261, size: 34)),
                "music": IconBar(side: .humans, cells: [
                    BarCell(left: 86, top: 222, size: 24), BarCell(left: 79, top: 215, size: 24),
                    BarCell(left: 67, top: 222, size: 24), BarCell(left: 59, top: 214, size: 24),
                    BarCell(left: 46, top: 222, size: 24), BarCell(left: 39, top: 213, size: 24),
                    BarCell(left: 27, top: 222, size: 24), BarCell(left: 20, top: 213, size: 24),
                    BarCell(left: -3, top: 215, size: 29),
                ]),
                "crystal": IconBar(side: .demons, cells: [
                    BarCell(left: 299, top: 205, size: 24), BarCell(left: 305, top: 198, size: 24),
                    BarCell(left: 317, top: 205, size: 24), BarCell(left: 322, top: 198, size: 24),
                    BarCell(left: 335, top: 205, size: 24), BarCell(left: 341, top: 197, size: 24),
                    BarCell(left: 354, top: 204, size: 24), BarCell(left: 359, top: 197, size: 24),
                    BarCell(left: 375, top: 197, size: 31),
                ]),
            ],
            labelLeft: 0.05,
            labelTop: 0.02
        )
    }()
}
