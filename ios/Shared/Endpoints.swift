import Foundation

/// Where the coordinator is.
///
/// One place rather than three, which is the whole content of this file.
/// The app's socket, the widget's REST read and the digest POST were all
/// building the same string by hand, and the origin is the one thing in
/// this project that is certain to need changing for a staging channel.
enum Endpoints {
    static let origin = "api.totaltossup.live"

    static func socket(channelId: String) -> URL {
        URL(string: "wss://\(origin)/channels/\(channelId)/ws")!
    }

    static func snapshot(channelId: String) -> URL {
        URL(string: "https://\(origin)/channels/\(channelId)/snapshot")!
    }

    static func digest(channelId: String) -> URL {
        URL(string: "https://\(origin)/channels/\(channelId)/digest")!
    }

    static func recent(channelId: String) -> URL {
        URL(string: "https://\(origin)/channels/\(channelId)/recent")!
    }

    static func devices(channelId: String) -> URL {
        URL(string: "https://\(origin)/channels/\(channelId)/devices")!
    }

    /// The channel directory. Not under /channels/:id -- it is a property
    /// of the deployed code rather than of any one channel, and no
    /// Durable Object is woken to serve it.
    static var channels: URL {
        URL(string: "https://\(origin)/channels")!
    }

    static func start(channelId: String) -> URL {
        URL(string: "https://\(origin)/channels/\(channelId)/start")!
    }
}
