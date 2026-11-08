import WidgetKit
import SwiftUI

/// The widget's faces. Small and medium share a spine -- Season, score,
/// position -- with medium adding the week-by-week picture.
struct SeasonWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SeasonEntry

    var body: some View {
        switch family {
        case .accessoryRectangular: lockScreen
        case .systemMedium: medium
        default: small
        }
    }

    private var snapshot: ChannelSnapshot? { entry.snapshot }

    // MARK: - Faces

    private var small: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let s = snapshot {
                header(s)
                Spacer(minLength: 0)
                ScoreLine(score: s.seasonScore, size: 30)
                positionLine(s)
                staleness
            } else {
                unavailable
            }
        }
    }

    private var medium: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                if let s = snapshot {
                    header(s)
                    Spacer(minLength: 0)
                    ScoreLine(score: s.seasonScore, size: 34)
                    positionLine(s)
                    staleness
                } else {
                    unavailable
                }
            }
            if let s = snapshot {
                VStack(alignment: .leading, spacing: 8) {
                    Text("WEEKS")
                        .font(.system(size: 9, weight: .bold, design: .rounded))
                        .foregroundStyle(Palette.fg.opacity(0.45))
                    WeekPips(snapshot: s)
                    Spacer(minLength: 0)
                    Text("ALL TIME")
                        .font(.system(size: 9, weight: .bold, design: .rounded))
                        .foregroundStyle(Palette.fg.opacity(0.45))
                    ScoreLine(score: s.lifetimeRecord, size: 17)
                }
                .frame(maxWidth: 110)
            }
        }
    }

    /// Lock screen is monochrome and tiny, so it gets the one sentence
    /// that matters rather than a shrunken version of the others.
    private var lockScreen: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let s = snapshot {
                Text("SEASON \(s.seasonNumber)")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                Text("\(s.seasonScore.humans)–\(s.seasonScore.demons)")
                    .font(.system(size: 20, weight: .black, design: .rounded))
                Text("W\(s.weekNumber)/\(s.weeksPerSeason) · N\(s.nightNumber)/\(s.nightsPerWeek)")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
            } else {
                Text("Total Tossup").font(.system(size: 12, weight: .bold, design: .rounded))
                Text("Unavailable").font(.system(size: 11)).foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Pieces

    private func header(_ s: ChannelSnapshot) -> some View {
        Text("SEASON \(s.seasonNumber)")
            .font(.system(size: 13, weight: .black, design: .rounded))
            .foregroundStyle(Palette.fg)
    }

    private func positionLine(_ s: ChannelSnapshot) -> some View {
        // A last Night of a last Week is the moment worth glancing at, so
        // it says so rather than making you do the arithmetic.
        let decider = s.weekNumber == s.weeksPerSeason && s.nightNumber == s.nightsPerWeek
        return Text(decider
            ? "Week \(s.weekNumber) · Night \(s.nightNumber) — decider"
            : "Week \(s.weekNumber) of \(s.weeksPerSeason) · Night \(s.nightNumber) of \(s.nightsPerWeek)")
            .font(.system(size: 10, weight: .semibold, design: .rounded))
            .foregroundStyle(decider ? Palette.demons : Palette.fg.opacity(0.6))
            .lineLimit(2)
    }

    private var staleness: some View {
        Text(entry.fetchedAt, style: .relative)
            .font(.system(size: 9, weight: .medium, design: .rounded))
            .foregroundStyle(Palette.fg.opacity(0.35))
    }

    private var unavailable: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("TOTAL TOSSUP").font(.system(size: 12, weight: .black, design: .rounded))
            Text("Couldn't reach the broadcast")
                .font(.system(size: 10)).foregroundStyle(Palette.fg.opacity(0.5))
        }
    }
}

private struct ScoreLine: View {
    let score: ContainerScore
    let size: CGFloat

    var body: some View {
        HStack(spacing: 4) {
            Text("\(score.humans)")
                .foregroundStyle(Palette.humans)
            Text(":")
                .foregroundStyle(Palette.fg.opacity(0.35))
            Text("\(score.demons)")
                .foregroundStyle(Palette.demons)
        }
        .font(.system(size: size, weight: .black, design: .rounded))
        .minimumScaleFactor(0.6)
        .lineLimit(1)
    }
}

/// The Season so far, one pip per week -- the same shape the app shows,
/// and the thing that reads fastest at a glance.
private struct WeekPips: View {
    let snapshot: ChannelSnapshot

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<snapshot.weeksPerSeason, id: \.self) { i in
                let result = snapshot.completedWeeks.first { $0.weekNumber == i + 1 }
                let current = i + 1 == snapshot.weekNumber
                RoundedRectangle(cornerRadius: 2)
                    .fill(result?.winner.map(Palette.side) ?? Palette.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: 2)
                            .stroke(Palette.fg, lineWidth: current ? 1.5 : 0.75)
                    )
                    .frame(height: 16)
            }
        }
    }
}
