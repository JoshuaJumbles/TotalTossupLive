import type { Digest, DigestPoint, SeasonSummary } from '@total-tossup-live/shared';
import { digestBetween, digestLines } from '@total-tossup-live/shared';

/**
 * The away digest, computed for a client that cannot compute it itself.
 *
 * ## Why this route exists when the web client needs no route
 *
 * The digest is a model, not a query. `digest.ts` is a rate table, a
 * weight function, an expectation gate and four or five recorded
 * judgements about what counts as news — and `digestCopy.ts` is a voice.
 * All of it is TypeScript in `shared/`, which the web client bundles, so
 * on web a digest costs the coordinator nothing and the client holds the
 * whole model for free.
 *
 * Swift cannot bundle it. The obvious move is to port it, and the obvious
 * move is wrong: a port is a *second* copy of every rate and every
 * judgement, and when the two drift there is no symptom. A wrong number
 * crashes; a stale rate table just quietly disagrees about what mattered,
 * on one platform, forever. That is the worst kind of duplication to own,
 * and this model is still being revised — a rate was corrected and two
 * criteria were added in the last week alone.
 *
 * So the non-TypeScript clients call the one implementation where it
 * already lives. There is still exactly one `digestBetween`; web reaches
 * it in the browser and iOS reaches it over HTTP. That asymmetry is
 * deliberate and worth leaving alone in both directions: do not port this
 * to Swift, and do not move the web client onto this route either — it
 * would give up the property that a normal return to the tab makes no
 * request at all, to buy a consistency that already holds.
 *
 * It is also the direction the sender has to go anyway. A push
 * notification is decided and worded with no client in the room, so the
 * worker must be able to render this project's copy server-side. This is
 * that same muscle, one step early.
 *
 * ## What the client gets to say, and what it doesn't
 *
 * The client sends only where it *was*. `now` is the coordinator's own
 * snapshot, because the coordinator is the authority on the present and a
 * client that passed its own `now` could be stale or simply wrong.
 *
 * The one number it does send is how long it was gone, and that is on
 * purpose rather than an oversight. Both ends of an absence were measured
 * on the device's clock, so a device whose clock is ten minutes out
 * cancels that error exactly; measuring the far end on the server's clock
 * instead would turn the skew into ten minutes of phantom absence. It is
 * also the only client-supplied number that can change an answer — it
 * drives the expectation gate — so it is clamped, and a client that sends
 * nothing falls back to the server's clock, which is right whenever the
 * two agree.
 */

/** A year. Past this the answer stops moving — every rated headline is
 * long since gated out and the register is already summarised — so the
 * clamp costs nothing and keeps a negative, a NaN or a 1e18 from a
 * hand-edited store out of the arithmetic. */
const MAX_AWAY_MS = 365 * 24 * 60 * 60 * 1000;

export interface DigestRequest {
  /**
   * Where the client was when it stopped watching.
   *
   * Called `lastSeen` on the wire and not `then`, which is what it is
   * called everywhere inside digest.ts and would have read better here.
   * A JSON body with a `then` key becomes a thenable the moment anything
   * puts a function there, and this body is parsed straight out of
   * `await request.json()` — so the name that reads best is the one that
   * quietly breaks a promise chain later. Named for the client's storage
   * key instead.
   */
  lastSeen: DigestPoint;
  awayMs: number;
}

/**
 * What a digest response carries.
 *
 * Both shapes, which is not indecision. `lines` is what a card prints,
 * and it is here so that no client ever owns a word of this project's
 * copy. `digest` is the structure behind it, and it is here because a
 * card wants more than strings: `side` is what colours a headline, and
 * `context` holds the scores a platform might lay out its own way. A
 * client that only prints uses `lines` and ignores the rest.
 */
export interface DigestResponse {
  digest: Digest | null;
  lines: ReturnType<typeof digestLines> | null;
}

function isScore(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const score = value as Record<string, unknown>;
  return typeof score.humans === 'number' && typeof score.demons === 'number';
}

/**
 * Read a client's stored point, or null if it isn't one.
 *
 * Validated rather than cast, and not for security — there is nothing
 * here worth attacking. It is because the body is a value a client wrote
 * to its own disk at some earlier version of this app and has been
 * carrying ever since, so "a shape an older build stored" is the normal
 * case and not the hostile one. `digestBetween` does arithmetic on these
 * fields the moment it is called, and a missing `lifetimeRecord` would be
 * a 500 from inside the Durable Object rather than a 400 the client can
 * recognise and recover from by forgetting its point and starting again.
 */
export function readDigestRequest(body: unknown, now: number): DigestRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { lastSeen, awayMs } = body as Record<string, unknown>;
  if (typeof lastSeen !== 'object' || lastSeen === null) return null;

  const point = lastSeen as Record<string, unknown>;
  if (typeof point.seenAt !== 'number' || !Number.isFinite(point.seenAt)) return null;
  for (const key of ['seasonNumber', 'weekNumber', 'nightsPerWeek', 'weeksPerSeason']) {
    if (typeof point[key] !== 'number') return null;
  }
  for (const key of ['weekScore', 'seasonScore', 'lifetimeRecord']) {
    if (!isScore(point[key])) return null;
  }
  if (!Array.isArray(point.completedWeeks)) return null;
  if (typeof point.seasonStreak !== 'object' || point.seasonStreak === null) return null;

  // The client's own measurement when it has one, the server's clock when
  // it doesn't. Clamped either way — see MAX_AWAY_MS.
  const measured = typeof awayMs === 'number' && Number.isFinite(awayMs)
    ? awayMs
    : now - (point.seenAt as number);

  return {
    lastSeen: lastSeen as unknown as DigestPoint,
    awayMs: Math.min(MAX_AWAY_MS, Math.max(0, measured)),
  };
}

/**
 * The digest for an absence, rendered.
 *
 * Pure, so the whole route is testable without standing up a Durable
 * Object — the same reason `applySeason` is pure.
 *
 * `now` is built by moving the client's own `seenAt` forward by the
 * absence it reported, rather than by stamping the server's clock:
 * `digestBetween` takes the gap between two points as the absence, so
 * handing it a pair whose gap is already the right one is how the
 * client's measurement gets used without the function needing to know
 * that two clocks were involved.
 */
export function digestResponseFor(
  request: DigestRequest,
  /** The coordinator's current snapshot. Typed as the fields a digest
   * actually reads rather than as ChannelSnapshot, which satisfies this
   * structurally — it says what this depends on, and it means a test does
   * not have to build a whole Night to exercise the route. */
  snapshot: Omit<DigestPoint, 'seenAt'>,
  seasons: SeasonSummary[],
): DigestResponse {
  const then = request.lastSeen;
  const now: DigestPoint = { ...snapshot, seenAt: then.seenAt + request.awayMs };
  const digest = digestBetween(then, now, seasons);
  return { digest, lines: digest ? digestLines(digest) : null };
}
