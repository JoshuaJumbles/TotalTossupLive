import Foundation

/**
 Fetches the ring and the ledger, once per visit.

 Deliberately not a live connection. The live view holds a socket because
 it is watching play happen; history is the opposite kind of thing -- it
 changes once every eighty-seven minutes when a Season closes, and a
 reader is consulting it rather than watching it. One read on open is
 both enough and the honest shape.

 Nor is it cached between visits. A ring that is one Season stale looks
 identical to a fresh one and would be wrong in the single way that
 matters -- the most recent Season missing -- so a visit always asks.
 */
@MainActor
final class HistoryStore: ObservableObject {
    enum State: Equatable {
        case idle
        case loading
        case loaded(ChannelHistory)
        case failed(String)

        static func == (a: State, b: State) -> Bool {
            switch (a, b) {
            case (.idle, .idle), (.loading, .loading): return true
            case let (.failed(x), .failed(y)): return x == y
            case let (.loaded(x), .loaded(y)):
                // Enough to tell one load from another; the ring is
                // keyed by its newest Season.
                return x.seasons.last?.seasonNumber == y.seasons.last?.seasonNumber
            default: return false
            }
        }
    }

    @Published private(set) var state: State = .idle

    private let channelId: String

    init(channelId: String) {
        self.channelId = channelId
    }

    func load() async {
        // A reload while one is in flight is a double-tap, not a request.
        if case .loading = state { return }
        state = .loading

        var request = URLRequest(url: Endpoints.recent(channelId: channelId))
        // The coordinator sends `no-store` on this route, but say it from
        // this end too: a cached ring is wrong in a way the screen cannot
        // detect, and this is the route that bug was found on.
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 15

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                state = .failed("The channel could not be reached.")
                return
            }
            state = .loaded(try JSONDecoder().decode(ChannelHistory.self, from: data))
        } catch is CancellationError {
            // The sheet was dismissed mid-flight. Not a failure, and
            // showing one would flash an error at someone already leaving.
            state = .idle
        } catch let error as DecodingError {
            // Kept separate from a network failure, and the separation
            // earns its place: the first version of this collapsed both
            // into "could not be reached", and when a field really was
            // decoded wrong it spent a debugging round looking at the
            // network. Same reasoning as ChannelClient.lastError -- a
            // shape this build cannot read is the thing most worth
            // seeing early, and it looks nothing like being offline.
            state = .failed("This build could not read the record book.\n\n\(error)")
        } catch {
            state = .failed("The channel could not be reached.")
        }
    }
}
