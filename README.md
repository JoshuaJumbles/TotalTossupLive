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
npm run dev:worker   # Cloudflare Worker (wrangler dev)
npm run dev:web      # Vite dev server
```

## Workflow

Trunk-based: `main` stays deployable, feature work happens on branches and
merges back via PR.
