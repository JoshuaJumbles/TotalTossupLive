import SwiftUI

@main
struct TotalTossupApp: App {
    /// A SwiftUI app still needs an app delegate for the remote-
    /// notification callbacks: there is no `App` hook for "APNs issued a
    /// token", and there is unlikely to be one, since those callbacks
    /// predate SwiftUI by a decade. See PushDelegate.
    @UIApplicationDelegateAdaptor(PushDelegate.self) private var delegate
    @StateObject private var push = PushRegistration(channelId: "main")

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(push)
                // The delegate is handed the registration rather than
                // owning it, so the object SwiftUI observes and the one
                // UIKit calls back into are the same instance.
                .onAppear { PushDelegate.registration = push }
        }
    }
}
