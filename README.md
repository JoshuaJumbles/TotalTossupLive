# Total Tossup Live

A perpetually-running, zero-input "sports broadcast" driven entirely by coin flips —
**Humans vs Demons**, live, the same for every viewer at once.

## System overview

The whole game is a nested race-to-N structure:

```
Channel                         one independent "Total Tossup History"
 └─ LifetimeRecord              flat season-win counters (Humans / Demons)
 └─ Season
     └─ Week (1..N)             win worth `weekNumber` season points
         └─ Night (1..N)        win worth `nightNumber` week points
             └─ Sheet instance  which Sheet (ruleset + theme) this Night plays
                 └─ Flip        one coin flip, the atomic event
```

Container sizes (Nights/Week, Weeks/Season) must keep their triangular point
pool `T(N) = N(N+1)/2` odd — i.e. `N mod 4 ∈ {1, 2}` — so no level of the
score system can ever tie. See `shared/src/scoring.ts`.

A **Family** is a rules engine (code). A **Sheet** is a themed configuration
of a Family (data). The debug Family/Sheet (`bestof`) plays best-of-5 rounds,
early-stop, race to 10 round-points to win a Night.

## Workspaces

- `shared/` — TypeScript types + pure scoring logic shared by worker and web
- `worker/` — Cloudflare Worker + Durable Object (the authoritative live coordinator) + D1
- `web/` — Vite + React + Tailwind + Framer Motion frontend

## Getting started

```bash
npm install
npm run dev:worker   # Cloudflare Worker (wrangler dev) — http://localhost:8788
npm run dev:web      # Vite dev server — http://localhost:5173
```

Run both at once, in separate terminals. Then open
`http://localhost:5173/?channel=battle` (the `?channel=` query param picks
which Durable Object you're viewing — `main`/`debug`/`battle`, see
`worker/src/presets.ts`). `battle` and `debug` boot into a `standby`
screen; click Start Season, or `curl -X POST
http://localhost:8788/channels/battle/start`.

`worker`'s `dev` script pins two flags, both fixing real collisions:
`--port 8788` (bare `wrangler dev` actually defaults to `8787` — `web`'s
own fallback API origin, `web/src/lib/config.ts`, assumes `8788`, so
without this the two sides silently never connect — no crash, `web` just
sits on "connecting…" forever) and `--inspector-port 9230` (`web`'s own
Cloudflare Vite plugin runs an embedded `workerd` for asset bindings,
which defaults to the same debugger port, `9229`, as `wrangler dev` —
whichever process starts second fails outright). If local dev ever
silently fails to connect,
that's usually a symptom of this same collision (e.g. after editing
`worker/package.json`'s `dev` script) — check for two processes fighting
over one port before anything else.

Durable Object storage persists across `wrangler dev` restarts in
`worker/.wrangler/state`. Delete that directory (`rm -rf
worker/.wrangler/state`) for a truly clean slate — useful after changing
anything that affects a channel's persisted shape.

## Workflow

Trunk-based: `main` stays deployable, feature work happens on branches and
merges back via PR.
