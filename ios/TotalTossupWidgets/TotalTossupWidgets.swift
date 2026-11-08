import WidgetKit
import SwiftUI

/// What the widget draws, and when it was true.
struct SeasonEntry: TimelineEntry {
    let date: Date
    let snapshot: ChannelSnapshot?
    /// When the snapshot was actually fetched, which is not `date` -- a
    /// timeline holds several entries built from one fetch, and the only
    /// thing that differs between them is how long ago that was.
    let fetchedAt: Date
}

/// Supplies the widget's timeline.
///
/// A note on what a widget here can and cannot show. The coordinator
/// broadcasts `phaseEndsAt` for the phase running *now*, but nothing
/// about what comes next or how long it lasts -- those live in the
/// channel's preset, server-side. And phases are short: a flip is two
/// seconds. So a widget cannot track live play, and shouldn't pretend
/// to; WidgetKit's refresh budget is tens of wakes a day, not one every
/// two seconds.
///
/// What it shows instead is the part that moves slowly and is worth
/// glancing at -- which Season, how far through it, who is ahead, and
/// which weeks have fallen. The several entries built from one fetch all
/// carry the same state and differ only in how stale they admit to
/// being, so "updated 20 minutes ago" stays honest without spending
/// another wake on it.
struct SeasonProvider: TimelineProvider {
    /// Roughly how often to ask for a wake. Comfortably inside the
    /// budget, and about as often as this is worth re-reading.
    private static let refreshInterval: TimeInterval = 20 * 60

    func placeholder(in context: Context) -> SeasonEntry {
        SeasonEntry(date: .now, snapshot: nil, fetchedAt: .now)
    }

    func getSnapshot(in context: Context, completion: @escaping (SeasonEntry) -> Void) {
        Task {
            let snapshot = try? await SnapshotFetcher.fetch()
            completion(SeasonEntry(date: .now, snapshot: snapshot, fetchedAt: .now))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SeasonEntry>) -> Void) {
        Task {
            let fetchedAt = Date.now
            let snapshot = try? await SnapshotFetcher.fetch()

            // One fetch, several entries. They say the same thing; what
            // changes is the "as of" line, so the widget ages gracefully
            // between wakes instead of looking confidently wrong.
            let entries = stride(from: 0.0, through: Self.refreshInterval, by: Self.refreshInterval / 4).map {
                SeasonEntry(date: fetchedAt.addingTimeInterval($0), snapshot: snapshot, fetchedAt: fetchedAt)
            }

            // A failed fetch asks to be woken sooner, but not so soon that
            // a flat network burns the day's budget.
            let next = fetchedAt.addingTimeInterval(snapshot == nil ? 5 * 60 : Self.refreshInterval)
            completion(Timeline(entries: entries, policy: .after(next)))
        }
    }
}

struct TotalTossupWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TotalTossupSeason", provider: SeasonProvider()) { entry in
            SeasonWidgetView(entry: entry)
                .containerBackground(Palette.bg, for: .widget)
        }
        .configurationDisplayName("Season")
        .description("Where the current Season stands.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

@main
struct TotalTossupWidgets: WidgetBundle {
    var body: some Widget {
        TotalTossupWidget()
    }
}
