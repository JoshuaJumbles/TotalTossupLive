# Total Tossup — iOS

A second **renderer** for the live coordinator, not a port of it. The
Worker remains the single authority: the app opens a WebSocket, decodes
the broadcast snapshot, and draws. There is no game logic here and there
should never be any — that is what lets every viewer, on every platform,
watch the same Night.

## Running it

```
open ios/TotalTossup.xcodeproj
```

or from the command line:

```
xcodebuild -project ios/TotalTossup.xcodeproj -scheme TotalTossup \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

It points at the live `main` channel. Nothing needs to be running
locally.

## What's here so far

This is the Phase 0 spike: connection, decode, and timing. Season, Week,
Night, the current phase with a countdown, the three scores, and the
Season's completed weeks as pips. Deliberately no Sheet art yet.

## Two conventions worth keeping

**Decode only what this build understands.** `ChannelSnapshot` declares
the fields it renders and nothing else, and `GamePhase` falls back to
`.unknown` rather than throwing. The web client is always current; a
shipped app is not, so it will meet snapshots written by a newer
coordinator. Ignoring unknown keys and unknown phases is what keeps an
old build working instead of crashing. The same posture will matter much
more once Family-specific `nightState` shapes are decoded.

**All timing comes from `phaseStartedAt` / `phaseEndsAt` plus the local
clock.** Nothing is pushed to drive a countdown. That is the same
contract the web client renders under, and it is what will let a widget
compute a whole WidgetKit timeline from a single fetch.
