import Foundation

/// A one-shot read of a channel's current state.
///
/// The app holds a WebSocket because it is watching play happen. A widget
/// can't -- extensions are woken briefly, rendered, and put away -- so it
/// uses the coordinator's plain REST snapshot instead. Same payload,
/// same decoding, no second wire format to keep in step.
enum SnapshotFetcher {
    static func fetch(channelId: String = "main") async throws -> ChannelSnapshot {
        var request = URLRequest(url: Endpoints.snapshot(channelId: channelId))
        // Widgets are woken on someone else's schedule; a stale cached
        // body would quietly defeat the whole point.
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 10
        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(ChannelSnapshot.self, from: data)
    }
}
