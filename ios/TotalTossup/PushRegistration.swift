import Foundation
import UIKit
import UserNotifications

/**
 The device's end of the notification path: ask, register, hand the token
 to the coordinator.

 There is no decision-making here either, for the same reason there is
 none in `AwayDigestStore`. What is worth a phone buzzing is a rate table
 and a budget that holds the channel to about one and a half
 interruptions a day, and it lives in `shared/src/notify.ts` where the
 sender can reach it. The app's whole job is to be reachable.

 ## When to ask

 Not on first launch. A permission prompt shown before anyone knows what
 the app is gets denied, and on iOS a denial is close to permanent --
 the system will not ask again, and the only way back is a trip to
 Settings that nobody makes. So `requestIfUseful` is deliberately not
 called from `onAppear`; it waits for a moment when the answer to "why
 would I want this?" is on screen. See ContentView.

 ## The environment is not knowable at runtime, so it is built in

 A token is only valid against the APNs host matching the build that
 produced it: a development build's token is rejected by the production
 host and the other way round, both with the same unhelpful
 BadDeviceToken. Apple provides no runtime API for which one you are, and
 the embedded provisioning profile's `aps-environment` entitlement is the
 only honest source. Reading it from the profile is possible and fragile;
 keying off the compiler's DEBUG flag is neither, and it is right for
 every way this app is actually built -- Xcode gives DEBUG builds the
 development entitlement, TestFlight and the App Store give release
 builds the production one.
 */
@MainActor
final class PushRegistration: NSObject, ObservableObject {
    enum Status: Equatable {
        case unasked
        case asking
        case registered
        case denied
        /// Asked and allowed, but APNs would not issue a token. Usual
        /// cause is a simulator with no signed-in Apple account, or no
        /// network.
        case unavailable(String)
    }

    @Published private(set) var status: Status = .unasked

    private let channelId: String
    private let defaults: UserDefaults
    /// Set once the system hands over a token, so a registration that
    /// has not changed is not re-posted on every launch.
    private var postedToken: String?

    init(channelId: String, defaults: UserDefaults = .standard) {
        self.channelId = channelId
        self.defaults = defaults
        super.init()
    }

    private var askedKey: String { "ttl.push.asked.\(channelId)" }
    private var tokenKey: String { "ttl.push.token.\(channelId)" }

    /// Whether the prompt is still worth showing. False once the system
    /// has an answer either way, so a caller can decide whether to offer
    /// the thing at all rather than putting up a button that does
    /// nothing.
    var canAsk: Bool {
        status == .unasked && !defaults.bool(forKey: askedKey)
    }

    /**
     Called on every launch. Never prompts.

     Apple is explicit that an app with permission must call
     `registerForRemoteNotifications()` at every launch rather than once
     ever: a token is not stable, and the system reissues it after a
     restore, an OS upgrade, or at its own discretion. An app that
     registered once and remembered the answer goes quietly unreachable
     some weeks later, which is the worst kind of bug this feature could
     have -- nothing fails, the pushes simply stop.

     It also settles `status`, so `canAsk` can tell "not asked yet" from
     "asked and declined" before anything is offered.
     */
    func refreshRegistration() async {
        switch await UNUserNotificationCenter.current().notificationSettings().authorizationStatus {
        case .denied:
            status = .denied
        case .authorized, .provisional, .ephemeral:
            status = .registered
            registerWithSystem()
        default:
            status = .unasked
        }
    }

    /**
     Ask, and register if allowed. Called from the opt-in, never on
     launch -- see NotifyPrompt for why the system prompt is spent only
     on someone who has already said yes to one of ours.

     Safe to call more than once: if the system already has an answer it
     is honoured without a second prompt, which iOS would not show
     anyway.
     */
    func requestIfUseful() async {
        let center = UNUserNotificationCenter.current()
        switch await center.notificationSettings().authorizationStatus {
        case .denied:
            status = .denied
            return
        case .authorized, .provisional, .ephemeral:
            await refreshRegistration()
            return
        default:
            break
        }

        status = .asking
        defaults.set(true, forKey: askedKey)
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            if granted {
                registerWithSystem()
            } else {
                status = .denied
            }
        } catch {
            status = .unavailable(error.localizedDescription)
        }
    }

    private func registerWithSystem() {
        UIApplication.shared.registerForRemoteNotifications()
    }

    /// Called from the app delegate once APNs issues a token.
    func received(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        status = .registered
        guard token != postedToken else { return }
        postedToken = token
        defaults.set(token, forKey: tokenKey)
        Task { await post(token: token) }
    }

    /// Called from the app delegate when APNs refuses.
    func failed(with error: Error) {
        status = .unavailable(error.localizedDescription)
    }

    private func post(token: String) async {
        var request = URLRequest(url: Endpoints.devices(channelId: channelId))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "token": token,
            "environment": Self.environment,
            "topic": Bundle.main.bundleIdentifier ?? "",
        ])

        // Failure is silent and recoverable rather than surfaced: the app
        // registers on every launch, so a post that did not land is
        // retried the next time the app opens, and there is nothing a
        // viewer could usefully do about it in the meantime.
        _ = try? await URLSession.shared.data(for: request)
    }

    /// Which of Apple's two push hosts will accept this build's tokens.
    /// See the type comment for why this is a compile-time answer.
    static var environment: String {
        #if DEBUG
            return "sandbox"
        #else
            return "production"
        #endif
    }
}

/**
 The bridge from UIKit's remote-notification callbacks into SwiftUI.

 A SwiftUI app still needs an app delegate for these two: there is no
 `App` protocol hook for "APNs issued a token", and there is unlikely to
 be one, since the callbacks predate SwiftUI by a decade.

 `presentation(for:)` is the other half of why this exists. By default
 iOS suppresses a notification while the app is in front, which is
 exactly backwards here: everything this channel pushes is an invitation
 to watch something that is happening *now*, so someone with the app
 open is the person most likely to act on it.
 */
final class PushDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    /// Set by the App at launch. Weak-ish by convention rather than by
    /// keyword: the registration object lives as long as the app does.
    static var registration: PushRegistration?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in Self.registration?.received(deviceToken: deviceToken) }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in Self.registration?.failed(with: error) }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
