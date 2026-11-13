import SwiftUI

@main
struct TotalTossupApp: App {
    /// A SwiftUI app still needs an app delegate for the remote-
    /// notification callbacks: there is no `App` hook for "APNs issued a
    /// token", and there is unlikely to be one, since those callbacks
    /// predate SwiftUI by a decade. See PushDelegate.
    @UIApplicationDelegateAdaptor(PushDelegate.self) private var delegate

    /**
     Push stays bound to the main channel, whatever is being watched.

     Deliberate, and the alternative is worse than it sounds. The
     notification budget lives in each channel's own Durable Object, so
     registering a device against `debug` would subscribe it to a
     separate budget running a 3/3 preset -- a channel built to hammer the
     state machine as fast as it can. Three pushes a day from each of
     eleven channels is not a feature.

     So this stays one registration, to the channel the product actually
     is. If browsing channels ever becomes a real viewer activity rather
     than a way to assess Families, per-channel subscription is a
     settings screen, not a default.
     */
    @StateObject private var push = PushRegistration(channelId: "main")

    /// Which channel is being watched. Remembered across launches so
    /// assessing a Family does not mean re-picking it on every reopen --
    /// and so a crash while watching `trifecta` comes back to `trifecta`,
    /// which is where the bug was.
    @AppStorage("ttl.channel") private var channelId = "main"

    @State private var pickingChannel = false

    var body: some Scene {
        WindowGroup {
            ContentView(channelId: channelId) { pickingChannel = true }
                // Every store inside ContentView is keyed to the channel,
                // and SwiftUI keeps a @StateObject for the lifetime of a
                // view's identity. Changing that identity is what tears
                // the old socket down and builds the new one; without
                // this the app would switch channels in the header and go
                // on rendering the previous channel's snapshots.
                .id(channelId)
                .environmentObject(push)
                // The delegate is handed the registration rather than
                // owning it, so the object SwiftUI observes and the one
                // UIKit calls back into are the same instance.
                .onAppear { PushDelegate.registration = push }
                .sheet(isPresented: $pickingChannel) {
                    ChannelPicker(
                        current: channelId,
                        choose: { picked in
                            channelId = picked
                            pickingChannel = false
                        },
                        dismiss: { pickingChannel = false }
                    )
                }
        }
    }
}
