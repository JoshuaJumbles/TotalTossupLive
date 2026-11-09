import Foundation

/// What happened while you were away, as the coordinator tells it.
///
/// ## Why there is no model in here
///
/// The decision about what counts as news is a rate table, a weight
/// function, an expectation gate and a handful of recorded judgements,
/// and all of it lives in `shared/src/digest.ts` — which the web client
/// bundles and this one cannot. Porting it to Swift would mean two copies
/// of every rate, and the failure mode of a drifted copy is not a crash:
/// it is the two platforms quietly disagreeing about what mattered, with
/// no symptom. So the coordinator computes it, and this file is a
/// renderer — the same discipline `ChannelClient` already works under.
///
/// What comes back is both the rendered copy and the structure behind it.
/// The copy because no client should own a word of this project's voice;
/// the structure because a card still needs to know which side a headline
/// is about in order to colour it.
struct AwayDigest {
    let title: String
    let headlines: [Line]
    let context: [String]

    struct Line: Identifiable {
        let id = UUID()
        let text: String
        /// Whose news it is, or nil when it belongs to neither side — the
        /// all-time record going level is nobody's headline.
        let side: Side?
    }
}

/// The wire shape of `POST /channels/:id/digest`.
///
/// Both halves are nullable together: the common answer to "what did I
/// miss" is nothing, and the coordinator says so by declining to build a
/// digest rather than by sending an empty one.
private struct DigestResponse: Decodable {
    struct Structured: Decodable {
        struct Headline: Decodable {
            let side: Side?
        }
        let headlines: [Headline]
    }

    struct Lines: Decodable {
        let title: String
        let headlines: [String]
        let context: [String]
    }

    let digest: Structured?
    let lines: Lines?

    /// Zipped into the shape a card renders. The two arrays are the same
    /// headlines in the same order — one as words, one as structure — so
    /// a mismatch means a server this build doesn't understand, and the
    /// honest response to that is no card.
    var digestForDisplay: AwayDigest? {
        guard let lines, let digest, lines.headlines.count == digest.headlines.count else {
            return nil
        }
        return AwayDigest(
            title: lines.title,
            headlines: zip(lines.headlines, digest.headlines).map {
                AwayDigest.Line(text: $0, side: $1.side)
            },
            context: lines.context
        )
    }
}

/**
 The viewer's own absence, and the card that reports it.

 Kept entirely on the device and keyed per channel, the same call the web
 client made: how long *you* were away is not something everyone watching
 the same channel needs to agree on, and there is nowhere to put it
 server-side until accounts exist.

 What is stored is the **raw bytes of the last snapshot seen**, not a
 re-encoded Swift struct. That is the important decision in this file.
 `ChannelSnapshot` decodes only the fields this build renders, on purpose,
 so that an old app keeps working against a newer coordinator — and
 re-encoding from it would throw away exactly the fields that choice was
 protecting. Round-tripping the bytes means a digest can be computed from
 parts of a snapshot this build has never heard of, and means there is no
 Swift encoding to drift from what the server expects.

 Two ways back into the app, and both have to work:

  - A cold launch. The stored point is whatever was last written, and the
    absence runs from there.
  - The scene becoming active again, which on iOS is the common one. The
    position stops being written the moment the scene leaves `.active`, so
    the stored point stays frozen at the start of the absence instead of
    creeping forward while nobody is looking.

 One thing is better here than on web: because the coordinator computes
 the digest, the request needs nothing but the stored point — so it can
 go out the instant the app comes forward, without waiting for the socket
 to reconnect and deliver a snapshot first. The card can be up before the
 live view is.
 */
@MainActor
final class AwayDigestStore: ObservableObject {
    @Published private(set) var digest: AwayDigest?

    private let channelId: String
    private let defaults: UserDefaults
    private var storageKey: String { "ttl.lastSeen.\(channelId)" }

    /// The most recent snapshot, as it arrived. Held so that freezing the
    /// position on the way to the background does not have to go looking
    /// for one.
    private var latest: Data?
    private var savedAt: Date = .distantPast
    private var active = true

    /// How often the watching position is written down. Snapshots arrive
    /// every couple of seconds and none of them is worth a disk write;
    /// all that matters is that the stored point is close to when
    /// watching actually stopped, and `freeze()` guarantees that part.
    private let saveEvery: TimeInterval = 15

    init(channelId: String, defaults: UserDefaults = .standard) {
        self.channelId = channelId
        self.defaults = defaults
    }

    /// Called with every snapshot the socket delivers, raw.
    func observed(_ raw: Data) {
        latest = raw
        guard active else { return }
        if Date().timeIntervalSince(savedAt) >= saveEvery { write(raw) }
    }

    /// The scene is leaving `.active`. Write the position here, so the
    /// absence is measured from the moment watching stopped rather than
    /// from the last periodic save.
    ///
    /// Forgetting the snapshot afterwards is the load-bearing half, and it
    /// closes a real hole. Come forward with no connection, get a digest,
    /// go back again before any snapshot arrives: without this, the next
    /// freeze would stamp *now* onto the body of a snapshot from before
    /// the first absence, and the digest after that would report every
    /// Season since then as having happened in the few minutes since. With
    /// it, nothing is written, the earlier point stands, and the next
    /// absence correctly runs from the last state actually seen — the same
    /// headlines again, but measured over the true gap, which is what the
    /// expectation gate needs to judge them by.
    func freeze() {
        active = false
        if let latest { write(latest) }
        latest = nil
    }

    /// The scene has become active, or the app has just launched. Asks the
    /// coordinator what was missed.
    func catchUp() async {
        active = true
        // A cold launch arrives here before any snapshot has been seen, so
        // the stored point is the only thing to go on — which is the whole
        // reason this needs no live snapshot.
        guard let stored = readStored() else { return }

        let away = Date().timeIntervalSince1970 * 1000 - stored.seenAt
        digest = await fetchDigest(lastSeen: stored.body, awayMs: away)
    }

    func dismiss() {
        digest = nil
    }

    // MARK: - Storage

    /// A stored point: the snapshot bytes as received, with `seenAt`
    /// spliced in alongside them. Written as one blob because that is
    /// already the exact shape the request body's `then` needs.
    private struct StoredPoint {
        let body: [String: Any]
        let seenAt: Double
    }

    private func write(_ raw: Data) {
        guard var object = try? JSONSerialization.jsonObject(with: raw) as? [String: Any] else {
            return
        }
        object["seenAt"] = Date().timeIntervalSince1970 * 1000
        guard let blob = try? JSONSerialization.data(withJSONObject: object) else { return }
        defaults.set(blob, forKey: storageKey)
        savedAt = .now
    }

    private func readStored() -> StoredPoint? {
        guard let blob = defaults.data(forKey: storageKey),
              let object = try? JSONSerialization.jsonObject(with: blob) as? [String: Any],
              let seenAt = object["seenAt"] as? Double
        else {
            // Written by an older shape, or never written. Either way the
            // answer is no digest rather than a crash on first render —
            // and the coordinator validates the body again regardless.
            return nil
        }
        return StoredPoint(body: object, seenAt: seenAt)
    }

    // MARK: - Network

    /// Nil on any failure, which is the right answer rather than a
    /// swallowed error: a digest is a nicety, and a dead card must never
    /// take the live view down with it. The absence is sent as a number
    /// this device measured, because both ends of it were measured on this
    /// device's clock and a clock that is wrong cancels there.
    private func fetchDigest(lastSeen: [String: Any], awayMs: Double) async -> AwayDigest? {
        var request = URLRequest(url: Endpoints.digest(channelId: channelId))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10
        request.httpBody = try? JSONSerialization.data(
            withJSONObject: ["lastSeen": lastSeen, "awayMs": awayMs]
        )
        guard request.httpBody != nil else { return nil }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return nil }
            if http.statusCode == 400 {
                // The coordinator could not read the stored point — an
                // older build's shape, most likely. Forget it rather than
                // sending it again on every launch forever.
                defaults.removeObject(forKey: storageKey)
                return nil
            }
            guard http.statusCode == 200 else { return nil }
            return try JSONDecoder().decode(DigestResponse.self, from: data).digestForDisplay
        } catch {
            return nil
        }
    }
}
