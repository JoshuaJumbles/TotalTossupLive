# web

Vite + React + TypeScript + Tailwind v4 + Framer Motion. Renders the live
channel — consumes `@total-tossup-live/shared`'s `ChannelSnapshot` type and,
on connect, will subscribe to the Worker's WebSocket/REST snapshot endpoint.

```bash
npm run dev       # from repo root: npm run dev:web
```

Linting is via [Oxlint](https://oxc.rs) (`npm run lint`).
