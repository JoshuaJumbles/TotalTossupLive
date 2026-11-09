import Foundation

/// Holds a live connection to one channel and republishes whatever the
/// coordinator last said.
///
/// The client is a renderer and nothing more -- there is no game logic
/// here, and there should never be any. The coordinator is the single
/// authority, which is what lets every viewer watch the same Night.
@MainActor
final class ChannelClient: ObservableObject {
    enum Status: Equatable {
        case connecting
        case live
        case reconnecting(attempt: Int)

        var label: String {
            switch self {
            case .connecting: return "Connecting…"
            case .live: return "Live"
            case .reconnecting(let n): return "Reconnecting (\(n))…"
            }
        }
    }

    @Published private(set) var snapshot: ChannelSnapshot?
    @Published private(set) var status: Status = .connecting
    /// The bytes the last snapshot arrived as, kept beside the decoded
    /// one. `ChannelSnapshot` decodes only the fields this build renders,
    /// so re-encoding it would discard exactly the parts that choice is
    /// there to protect -- and the away digest has to hand a whole past
    /// snapshot back to the coordinator. See AwayDigestStore.
    @Published private(set) var raw: Data?
    /// Surfaced rather than swallowed: a decode that fails against a newer
    /// server is the main thing worth seeing early.
    @Published private(set) var lastError: String?

    private let channelId: String
    private var task: URLSessionWebSocketTask?
    private var attempt = 0
    private var closed = false

    init(channelId: String) {
        self.channelId = channelId
    }

    private var socketURL: URL { Endpoints.socket(channelId: channelId) }

    func connect() {
        closed = false
        openSocket()
    }

    func disconnect() {
        closed = true
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func openSocket() {
        task?.cancel()
        let socket = URLSession.shared.webSocketTask(with: socketURL)
        task = socket
        socket.resume()
        receive()
    }

    private func receive() {
        task?.receive { [weak self] result in
            Task { @MainActor in
                guard let self, !self.closed else { return }
                switch result {
                case .success(let message):
                    self.handle(message)
                    self.receive()
                case .failure(let error):
                    self.scheduleReconnect(after: error)
                }
            }
        }
    }

    private func handle(_ message: URLSessionWebSocketTask.Message) {
        let data: Data?
        switch message {
        case .string(let text): data = text.data(using: .utf8)
        case .data(let raw): data = raw
        @unknown default: data = nil
        }
        guard let data else { return }

        do {
            snapshot = try JSONDecoder().decode(ChannelSnapshot.self, from: data)
            // Only after a successful decode: bytes that can't be read
            // aren't a snapshot, and storing them as the last-seen point
            // would hand the coordinator something no build understood.
            raw = data
            attempt = 0
            status = .live
            lastError = nil
        } catch {
            // Kept visible on purpose. If a newer coordinator ever sends a
            // shape this build can't read, that should be obvious on the
            // screen rather than looking like a dead connection.
            lastError = "Could not read snapshot: \(error)"
        }
    }

    private func scheduleReconnect(after error: Error) {
        attempt += 1
        status = .reconnecting(attempt: attempt)
        lastError = error.localizedDescription
        // Backs off but stays responsive -- this is a thing people leave
        // open, so it has to recover from a tunnel or a locked phone
        // without hammering the worker.
        let delay = min(30, pow(1.6, Double(min(attempt, 8))))
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(delay))
            guard !closed else { return }
            openSocket()
        }
    }
}
