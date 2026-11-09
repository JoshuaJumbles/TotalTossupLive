import SwiftUI

/// The card that says what you missed.
///
/// Over the live view rather than beside it, and dismissed by hand. A
/// digest describes a moment that has already closed, so it should not
/// scroll away in a feed of things still happening — and it should not
/// disappear on its own either, since the whole premise is that it only
/// appears when something was worth reading.
///
/// Headlines are set large and all-caps, in the display face the rest of
/// the app uses, and carry no full stop: the copy comes from the server
/// without one, for the reason written down in `digestCopy.ts` -- a
/// terminal period under a stack of capitals reads as a typo. Context
/// lines are ordinary sentences and keep theirs.
struct DigestCard: View {
    let digest: AwayDigest
    let dismiss: () -> Void

    var body: some View {
        ZStack {
            // A scrim, tappable, so the card can be got rid of the way
            // every other modal on the platform can.
            Palette.fg.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture(perform: dismiss)

            VStack(alignment: .leading, spacing: 0) {
                Text(digest.title.uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Palette.fg.opacity(0.55))
                    .padding(.bottom, 14)

                ForEach(digest.headlines) { headline in
                    Text(headline.text.uppercased())
                        .font(.system(.title3, design: .rounded).weight(.black))
                        .foregroundStyle(headline.side.map(Palette.side) ?? Palette.fg)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.bottom, 10)
                }

                if !digest.context.isEmpty {
                    Rectangle()
                        .fill(Palette.fg)
                        .frame(height: 2)
                        .padding(.vertical, 8)

                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(digest.context.enumerated()), id: \.offset) { _, line in
                            Text(line)
                                .font(.footnote)
                                .foregroundStyle(Palette.fg.opacity(0.8))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }

                Button(action: dismiss) {
                    Text("WATCH")
                        .font(.system(.subheadline, design: .rounded).weight(.black))
                        .foregroundStyle(Palette.bg)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Palette.fg)
                }
                .padding(.top, 18)
            }
            .padding(20)
            .background(Palette.bg)
            .overlay(Rectangle().stroke(Palette.fg, lineWidth: 3))
            .padding(.horizontal, 24)
        }
        .transition(.opacity)
    }
}
