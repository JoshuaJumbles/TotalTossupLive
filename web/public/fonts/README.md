# Fonts go here

`src/index.css` already has `@font-face` rules wired up for these — drop
the licensed `.woff2` files in this directory with these exact names and
they'll pick up with no other code changes:

- `Cubano-Regular.woff2`
- `Cubano-Italic.woff2`
- `GothamRounded-Light.woff2`
- `GothamRounded-Book.woff2`
- `GothamRounded-Bold.woff2`

Until they're here, every `font-display`/`font-body` element falls
through to the fallback stack in `index.css`'s `@theme` block.
