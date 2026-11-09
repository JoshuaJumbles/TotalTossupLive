/**
 * Where the coin's randomness comes from.
 *
 * `Math.random()` was doing this job, and as a fair coin it was adequate:
 * V8's xorshift128+ is a good generator, and nothing about a channel of
 * coin flips is adversarial. But it is seeded per isolate from an
 * unspecified source, it is not a CSPRNG, and — the part that actually
 * matters here — there is nothing to point at. The flips are the engine
 * the whole thing runs on, so where they come from should be nameable.
 *
 * `crypto.getRandomValues` is available in Workers, is a CSPRNG seeded
 * from the host's entropy pool, and is a strict improvement for nothing.
 *
 * ## Why a pool, rather than a call per flip
 *
 * The channel turns over roughly 43,000 flips a day and each one needs a
 * single bit, so asking the platform for eight at a time is wasteful in a
 * way that will never show up in a profile. The pool is not here for
 * speed. It is here because it is the shape a *remote* entropy source
 * needs: bits from something like Random.org cannot be fetched per flip —
 * that is an HTTP request, and a broadcast on a two-second tick cannot
 * wait on one — so they have to be pre-fetched into a reservoir that
 * flips are spent from and that refills before it runs dry. Building the
 * reservoir now means swapping the source later is a change to one
 * function, `refill`, and not to the coordinator at all.
 *
 * The pool lives in isolate memory rather than in Durable Object storage,
 * which is the right trade for a CSPRNG (a cold start just draws fresh
 * bytes) and the wrong one for a remote source, where unspent bits are
 * something you paid for. That is a problem for whoever adds the remote
 * source, and the note is here so they meet it on purpose.
 *
 * Spending is byte-granular, not bit-granular: a flip costs eight bits
 * where it needs one. At 43,000 flips a day that is 344,000 bits, which
 * still sits inside a Random.org daily quota with room over, and it keeps
 * `randomBelow` a straightforward read rather than a cursor into a
 * bitfield. Worth revisiting only if a quota starts to bind.
 */

/** Bytes drawn per refill. Small enough that a cold isolate is not doing
 * visible work, large enough that the channel refills a couple of hundred
 * times a day rather than tens of thousands. */
const POOL_BYTES = 256;

/** How a refill gets its bytes. Replaceable so tests can be deterministic,
 * and so a remote source can take over without the coordinator knowing. */
export type Refill = (into: Uint8Array) => void;

const fromPlatform: Refill = (into) => {
  crypto.getRandomValues(into);
};

let refill: Refill = fromPlatform;
let pool = new Uint8Array(0);
let spent = 0;

/** Point the pool at a different source, and discard whatever is left of
 * the current one. For tests today; for Random.org later. */
export function useEntropySource(source: Refill): void {
  refill = source;
  pool = new Uint8Array(0);
  spent = 0;
}

/** Back to `crypto.getRandomValues`. */
export function useDefaultEntropySource(): void {
  useEntropySource(fromPlatform);
}

function nextByte(): number {
  if (spent >= pool.length) {
    pool = new Uint8Array(POOL_BYTES);
    refill(pool);
    spent = 0;
  }
  return pool[spent++];
}

/**
 * A uniform integer in [0, bound), with no modulo bias.
 *
 * `byte % bound` is the obvious way and is biased whenever 256 is not a
 * multiple of `bound`: for a bound of 3, the values 0 and 1 each come
 * from 86 of the 256 bytes and 2 from only 84, so one of the three is
 * about 2% rare. Tiny, and exactly the kind of tiny this module exists to
 * refuse — there is no point sourcing better bits and then tilting them on
 * the way out. So draw enough bytes to cover the bound, reject the ragged
 * tail above the last whole multiple, and try again.
 */
export function randomBelow(bound: number): number {
  if (bound <= 1) return 0;

  const bytes = Math.ceil(Math.log2(bound) / 8);
  const range = 256 ** bytes;
  const limit = range - (range % bound);

  for (;;) {
    let value = 0;
    for (let i = 0; i < bytes; i += 1) value = value * 256 + nextByte();
    if (value < limit) return value % bound;
  }
}
