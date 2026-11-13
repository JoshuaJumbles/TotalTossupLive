import SwiftUI

/**
 Hand-drawn marks, as vector strokes.

 ## Why the marks are paths and not pictures

 Settled on with Joshua for every Family: a mark is an ordered list of
 strokes, drawn in sequence, revealed along their own length. Battle and
 Teamwork get away with a single crossout image because that is all their
 mark is. Trifecta's are authored bursts and scribbles, several strokes
 each, and the later Families need more than that again -- Creation fills
 regions procedurally, and Rock Paper Flipper has to *compute* an arrow
 between two positions, which no exported asset can do.

 It also matters after the animation stops. Joshua sleeves finished
 Sheets in a card-collector book -- "a little storybook of dramatic
 conflict" -- so the settled ink is the point, not the reveal, and vector
 marks make a printable keepsake export nearly free.

 ## The subset of SVG this needs

 Measured rather than assumed: across all 122 paths in the six Trifecta
 Sheets, the only commands that appear are M, c, s, l, h and Z. So the
 parser below handles exactly those and refuses anything else rather than
 guessing -- a silently mis-parsed curve draws a plausible wrong mark,
 which is the failure mode worth making loud.
 */

struct MarkViewBox {
    let minX: Double
    let minY: Double
    let width: Double
    let height: Double
}

/// One stroke: its path data and its measured length, which drives both
/// the reveal and the share of the round's pause it gets.
struct MarkStroke {
    let length: Double
    let d: String
}

/// One Sheet's marks. Nine targets a side, each an ordered list of
/// strokes; losing all nine loses the Night.
struct DrawnMarkSet {
    let viewBox: MarkViewBox
    let strokeWidth: Double
    let humans: [[MarkStroke]]
    let demons: [[MarkStroke]]

    func strokes(for side: Side, target: Int) -> [MarkStroke]? {
        let targets = side == .humans ? humans : demons
        guard target >= 0, target < targets.count else { return nil }
        return targets[target]
    }
}

/**
 An SVG path's `d` attribute, as a SwiftUI Path.

 Deliberately small and deliberately strict. The commands are the six the
 Trifecta exports actually use; anything else returns nil so a future
 export that introduces, say, an arc fails visibly at the first mark
 rather than drawing most of one.

 `s` is the only subtle one: a smooth cubic reflects the previous curve's
 second control point through the current point, so it has to remember
 what the last command was. A missing reflection does not error -- it
 draws a curve with a kink nobody would question.
 */
enum MarkPathParser {
    static func path(from d: String) -> Path? {
        let scanner = Scanner(string: d)
        scanner.charactersToBeSkipped = CharacterSet(charactersIn: " ,\n\t\r")

        var path = Path()
        var current = CGPoint.zero
        var start = CGPoint.zero
        /// The previous curve's second control point, for `s`.
        var lastControl: CGPoint?
        var command: Character?

        func number() -> Double? { scanner.scanDouble() }

        while !scanner.isAtEnd {
            // A command letter, or an implicit repeat of the previous one
            // (SVG lets "c" be followed by several coordinate sextets).
            if let letter = scanner.scanCharacter() {
                if letter.isLetter {
                    command = letter
                } else {
                    // Not a letter: put it back by rewinding one index and
                    // reuse the standing command.
                    scanner.currentIndex = scanner.string.index(before: scanner.currentIndex)
                }
            }
            guard let active = command else { return nil }

            switch active {
            case "M":
                guard let x = number(), let y = number() else { return nil }
                current = CGPoint(x: x, y: y)
                start = current
                path.move(to: current)
                lastControl = nil

            case "l":
                guard let dx = number(), let dy = number() else { return nil }
                current = CGPoint(x: current.x + dx, y: current.y + dy)
                path.addLine(to: current)
                lastControl = nil

            case "h":
                guard let dx = number() else { return nil }
                current = CGPoint(x: current.x + dx, y: current.y)
                path.addLine(to: current)
                lastControl = nil

            case "c":
                guard let x1 = number(), let y1 = number(),
                      let x2 = number(), let y2 = number(),
                      let x = number(), let y = number() else { return nil }
                let c1 = CGPoint(x: current.x + x1, y: current.y + y1)
                let c2 = CGPoint(x: current.x + x2, y: current.y + y2)
                current = CGPoint(x: current.x + x, y: current.y + y)
                path.addCurve(to: current, control1: c1, control2: c2)
                lastControl = c2

            case "s":
                guard let x2 = number(), let y2 = number(),
                      let x = number(), let y = number() else { return nil }
                // The first control point is the previous curve's second
                // reflected through the current point; with no previous
                // curve it coincides with the current point.
                let reflected = lastControl.map {
                    CGPoint(x: 2 * current.x - $0.x, y: 2 * current.y - $0.y)
                } ?? current
                let c2 = CGPoint(x: current.x + x2, y: current.y + y2)
                current = CGPoint(x: current.x + x, y: current.y + y)
                path.addCurve(to: current, control1: reflected, control2: c2)
                lastControl = c2

            case "Z", "z":
                path.closeSubpath()
                current = start
                lastControl = nil

            default:
                // Unhandled command. Loud on purpose -- see the type
                // comment.
                return nil
            }
        }

        return path
    }
}
