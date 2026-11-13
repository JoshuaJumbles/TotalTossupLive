import SwiftUI

/**
 The ask before the ask.

 iOS gives an app exactly one chance at the system permission prompt. A
 denial is close to permanent -- the system never asks again, and the way
 back is a trip to Settings that almost nobody makes. So the system
 prompt is worth spending only on someone who has already said yes to a
 prompt of ours, which costs nothing when refused.

 It is shown after a digest, and otherwise after a minute of watching.
 The digest is the better of the two moments by some distance: the card
 the viewer just read is a list of things that happened while they were
 not looking, which is the entire argument for this feature, made with
 their own data rather than by a sentence here.

 The copy quotes the real rate. notify.ts holds the channel to a budget
 of three a day and measures out at about 1.5, so "once or twice a day"
 is a number this project can actually keep, and saying it is the
 difference between a permission request and a promise.
 */
struct NotifyPrompt: View {
    let turnOn: () -> Void
    let notNow: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("GET THE GOOD ONES")
                .font(.system(.subheadline, design: .rounded).weight(.black))

            Text("A Season decided on the last Night. A comeback from 0-3 down. An all-time record going. Once or twice a day, never more than three.")
                .font(.footnote)
                .foregroundStyle(Palette.fg.opacity(0.75))
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 10) {
                Button(action: turnOn) {
                    Text("TURN ON")
                        .font(.system(.footnote, design: .rounded).weight(.black))
                        .foregroundStyle(Palette.bg)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Palette.fg)
                }
                Button(action: notNow) {
                    Text("NOT NOW")
                        .font(.system(.footnote, design: .rounded).weight(.black))
                        .foregroundStyle(Palette.fg.opacity(0.6))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .overlay(Rectangle().stroke(Palette.fg.opacity(0.3), lineWidth: 2))
                }
            }
            .padding(.top, 2)
        }
        .padding(16)
        .background(Palette.card)
        .overlay(Rectangle().stroke(Palette.fg, lineWidth: 2))
    }
}
