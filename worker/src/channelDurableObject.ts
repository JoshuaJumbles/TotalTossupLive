import type {
  BestOfSheetConfig,
  ChannelPayload,
  ChannelSnapshot,
  CoinFace,
  Flip,
  GamePhase,
  NotifyBudgetState,
  RecordLedger,
  SeasonSummary,
} from '@total-tossup-live/shared';
import {
  addPoints,
  applySeason,
  containerWinner,
  dramaFor,
  emptyLedger,
  emptyScore,
  emptyStreak,
  isContainerDecided,
  NotificationBudget,
  notableBreaks,
  pushSeason,
  seasonsSince,
} from '@total-tossup-live/shared';
import type { ApnsToken } from './apns';
import { alertPayload, mintToken, push, readCredentials, tokenIsFresh } from './apns';
import { digestResponseFor, readDigestRequest } from './awayDigest';
import type { DeviceRegistration } from './devices';
import { readRegistration, withDevice, withoutDevice } from './devices';
import { randomBelow } from './entropy';
import { deliver, sendsFor } from './sender';
import { engineFor } from './families/registry';
import { presetFor, sheetForNight, type ChannelPreset } from './presets';

export interface Env {
  CHANNEL: DurableObjectNamespace;
  /**
   * APNs token-auth credentials, set with `wrangler secret put`. All
   * three absent is a supported state and not a misconfiguration: the
   * whole decision path — drama, budget, copy, payload — runs without
   * them and simply has nowhere to send, which is what let this ship and
   * be measured before the key existed. See apns.ts.
   */
  APNS_KEY?: string; // the .p8, PEM, exactly as downloaded
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  // DB: D1Database; // enabled once wrangler.toml's d1_databases block is filled in
  ADMIN_TOKEN?: string; // set via `wrangler secret put ADMIN_TOKEN`; /reset is disabled without it
}

const SNAPSHOT_KEY = 'snapshot';
const PENDING_FACE_KEY = 'pendingFace';
/** The Season-summary ring. Its own key on purpose: it is read by the
 * /recent route alone and must never be loaded, serialised or broadcast on
 * the per-flip path. See SeasonSummary in shared. */
const HISTORY_KEY = 'history';
/** The all-time record ledger. Alongside the ring rather than inside it
 * because the ring forgets and this must not. See shared/src/records.ts. */
const RECORDS_KEY = 'records';
/** The devices to push to. Scoped to this channel on purpose — see
 * devices.ts for why this is Durable Object storage and not D1. */
const DEVICES_KEY = 'devices';
/** What the notification budget has already offered and sent. The one
 * thing in this project that has to be remembered rather than recomputed
 * (see notify.ts), and the reason the sender is stateful at all. */
const NOTIFY_KEY = 'notifyBudget';

/**
 * What every read route answers with.
 *
 * `no-store` is the load-bearing half. These routes are GETs on a custom
 * domain in front of a Worker, which means Cloudflare's edge is entitled
 * to cache them, and it does — a deploy that was already live was served
 * as its old self for minutes, from two different hostnames, until a
 * cache-busting query string got through. Harmless for /snapshot, which
 * only the widget reads and which is wrong by two seconds anyway; not
 * harmless for /recent, where a cached ring means a digest describing an
 * absence with the wrong Seasons in it and no way for the client to tell.
 */
const READ_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};

function randomFace(): CoinFace {
  return randomBelow(2) === 0 ? 'heads' : 'tails';
}

/** Every Family's NightState carries a currentRound.flips array (see
 * shared/src/family.ts's per-Family NightState doc comments) — this only
 * needs that much of the shape, not any one Family's full state. */
function pendingFlipFor(nightState: { currentRound: { flips: Flip[] } }) {
  return { sequenceIndex: nightState.currentRound.flips.length, face: null, winner: null };
}

/** Fisher-Yates shuffle of [0..n-1]. Used for unitCrossOrder — the random
 * choice is made once here, up front, rather than one pick at a time as
 * each round resolves, which keeps bestOfEngine.applyFlip() a pure function
 * (same pattern as randomFace(): all randomness lives in the coordinator,
 * never inside a Family engine). */
function shuffleIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Everything that changes when a new Night begins: which Sheet plays (per-
 * Night rotation, see presets.ts), a fresh Family-engine Night state, and a
 * fresh unitCrossOrder shuffle sized to that Sheet's targetRoundPoints.
 * Called from ensureStarted() and every beginNextStep() case that starts a
 * new Night (night_won/week_won/season_won).
 */
function beginNight(preset: ChannelPreset, nightNumber: number) {
  const sheet = sheetForNight(preset, nightNumber);
  // 'battle' is the only style with a *unit grid* to shuffle a cross-off
  // order for — the Teamwork styles and the plain 'simple' debug view have
  // no unit grid, and TeamworkSheetConfig doesn't even carry a
  // targetRoundPoints field to size the shuffle from. Trifecta does shuffle
  // its own targets, but draws that through initNight below (see
  // families/types.ts's Shuffle) so the order lives in its own Night state
  // rather than in this Battle-shaped snapshot field.
  const unitCrossOrder =
    sheet.style === 'battle'
      ? (() => {
          const n = (sheet.config as BestOfSheetConfig).targetRoundPoints;
          return { humans: shuffleIndices(n), demons: shuffleIndices(n) };
        })()
      : { humans: [], demons: [] };
  return {
    sheetId: sheet.id,
    familyId: sheet.familyId,
    sheetConfig: sheet.config,
    sheetStyle: sheet.style,
    nightState: engineFor(sheet.familyId).initNight(sheet.config, shuffleIndices),
    unitCrossOrder,
  };
}

/**
 * Backfills fields that an older persisted snapshot may be missing —
 * Durable Object storage survives code deploys, so a channel that's been
 * running since before ChannelSnapshot grew a field (completedWeeks,
 * nightsPerWeek, weeksPerSeason, sheetStyle, unitCrossOrder have all landed
 * after the first production deploy at various points) keeps that field
 * absent forever unless something fills it in. Applied once at the read
 * boundary; every mutation path re-persists the full object via commit(),
 * so a channel self-heals to the complete shape after its very next phase
 * transition — no separate migration step needed.
 */
function withDefaults(snapshot: ChannelSnapshot): ChannelSnapshot {
  const preset = presetFor(snapshot.channelId);
  return {
    ...snapshot,
    completedWeeks: snapshot.completedWeeks ?? [],
    // An already-running channel backfills to [] rather than to anything
    // reconstructed: weekScore knows how many Nights each side has won
    // but not the order they fell in, which is the only thing this field
    // is for. The cost is that the Week in progress at deploy time can't
    // report a comeback; it self-heals at that Week's end.
    completedNights: snapshot.completedNights ?? [],
    nightsPerWeek: snapshot.nightsPerWeek ?? preset.nightsPerWeek,
    weeksPerSeason: snapshot.weeksPerSeason ?? preset.weeksPerSeason,
    sheetStyle: snapshot.sheetStyle ?? 'simple',
    unitCrossOrder: snapshot.unitCrossOrder ?? { humans: [], demons: [] },
    seasonStreak: snapshot.seasonStreak ?? emptyStreak(),
  };
}

/**
 * The authoritative live coordinator for one channel. Owns the phase clock
 * (via alarm()), the current Season/Week/Night/Sheet position, and the
 * WebSocket fan-out to every connected viewer. Holds zero knowledge of *how*
 * a Night is won — that's delegated to whichever Family engine the current
 * Sheet names (see shared/src/family.ts and families/*.ts) — this class
 * only knows phases, timing, and Night→Week→Season→History bookkeeping.
 *
 * Every number that shapes the game (container sizes, Sheet rotation, phase
 * durations) comes from presetFor(channelId) — see presets.ts — rather
 * than being hardcoded here, so a "debug" or "battle" channel can run a
 * different preset side by side with the real "main" one, with zero
 * special-casing in this class beyond reading the right preset for
 * whichever channel this is.
 *
 * Clients never receive "do this now" events — every broadcast is a full
 * ChannelSnapshot with absolute phaseStartedAt/phaseEndsAt timestamps, so
 * any viewer (new or reconnecting) can render in sync purely from that plus
 * their local clock.
 */
export class ChannelDurableObject implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  /**
   * The notification budget, held in memory between requests.
   *
   * The one cached thing in this class, and it needs its reason. Every
   * other piece of state is read from storage each time it is used,
   * which is right for state that is small or rarely touched. This one
   * is neither: the sender runs on every commit, so every two seconds,
   * and the budget's seen-set carries about 222 occurrence keys a day
   * across a seven-day horizon. Deserialising that on the flip path
   * would be the most expensive thing the coordinator does, in service
   * of a decision that says "nothing" 99.99% of the time.
   *
   * Caching is safe here precisely because it is derived from storage:
   * an evicted object comes back with this undefined and reloads. That
   * is the opposite of the WebSocket list, which must never be cached,
   * because those survive hibernation while memory does not.
   */
  private budget?: NotificationBudget;

  /**
   * The APNs provider token. Cached for the same reason and one more of
   * its own: Apple refuses a token re-minted more than once every twenty
   * minutes, so this is a correctness cache, not only a performance one.
   */
  private apnsToken: ApnsToken | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const channelId = url.pathname.match(/^\/channels\/([^/]+)/)?.[1] ?? 'unknown';
    await this.ensureStarted(channelId);

    if (url.pathname.endsWith('/ws')) {
      return this.handleWebSocketUpgrade(request);
    }

    if (url.pathname.endsWith('/snapshot')) {
      // Permissive CORS: read-only, no mutations happen over this route, so
      // this is safe to leave open for local dev / direct-from-browser
      // debugging. Worth tightening to the real web origin once deployed.
      return Response.json(this.payloadFor(await this.getSnapshot()), {
        headers: READ_HEADERS,
      });
    }

    if (url.pathname.endsWith('/recent')) {
      // Recent Seasons, oldest first, optionally only those after
      // ?since=<seasonNumber>. Its own route rather than a snapshot field
      // because the cost profile is the opposite: a snapshot is small and
      // goes out constantly, this is larger and is wanted almost never —
      // the away digest fetches it only when an absence actually crossed a
      // Season boundary, which on a normal return is never.
      //
      // One order, oldest first, matching the ring itself: a client that
      // wants newest-first can reverse twenty-four entries more cheaply
      // than two consumers can disagree about which end is the front.
      //
      // The record ledger rides along unfiltered. It is a handful of
      // numbers, every consumer of the ring wants it, and unlike the
      // Seasons it is a running state rather than a window — "the longest
      // run ever is 9" is the same answer whoever asks.
      const since = Number(url.searchParams.get('since'));
      const history = await this.getHistory();
      const seasons = Number.isFinite(since) ? seasonsSince(history, since) : history;
      return Response.json({ seasons, records: await this.getLedger() }, { headers: READ_HEADERS });
    }

    if (url.pathname.endsWith('/devices') && request.method === 'POST') {
      // Register a device for this channel's pushes. Idempotent by
      // token, and called on every app launch rather than once ever —
      // a token can be reissued, and the environment it belongs to can
      // change under a device that keeps the same one. See devices.ts.
      const device = readRegistration(await request.json().catch(() => null), Date.now());
      if (!device) {
        return new Response('bad registration', { status: 400, headers: READ_HEADERS });
      }
      const devices = withDevice(await this.getDevices(), device);
      await this.state.storage.put(DEVICES_KEY, devices);
      return Response.json({ registered: true, devices: devices.length }, { headers: READ_HEADERS });
    }

    if (url.pathname.endsWith('/digest') && request.method === 'POST') {
      // The away digest for a client that can't compute it — see
      // awayDigest.ts for why that is iOS and not web. POST because the
      // request body is the client's stored point and because a GET here
      // would be edge-cached, which is the bug /recent already had.
      //
      // The whole ring goes in unfiltered: digestBetween clamps its own
      // window off the all-time record at both ends, so there is no
      // `since` for this route to get wrong, and the ring is twenty-four
      // entries.
      const parsed = readDigestRequest(await request.json().catch(() => null), Date.now());
      if (!parsed) {
        return new Response('bad digest point', { status: 400, headers: READ_HEADERS });
      }
      const response = digestResponseFor(
        parsed,
        await this.getSnapshot(),
        await this.getHistory(),
      );
      return Response.json(response, { headers: READ_HEADERS });
    }

    if (url.pathname.endsWith('/start') && request.method === 'POST') {
      // Ungated — starting a Season isn't destructive, unlike /reset, so
      // this is meant to be a plain public button. No-op (just returns the
      // current snapshot) if the channel isn't actually in standby. Needs
      // the same permissive CORS header as /snapshot — the StandbyScreen
      // button calls this directly from the browser.
      const snapshot = await this.getSnapshot();
      if (snapshot.phase === 'standby') {
        await this.commit({ ...snapshot, ...this.timestampsFor(channelId, 'season_launch') });
      }
      return Response.json(this.payloadFor(await this.getSnapshot()), {
        headers: READ_HEADERS,
      });
    }

    if (url.pathname.endsWith('/reset') && request.method === 'POST') {
      // Minimal admin escape hatch: wipes this channel's storage and
      // re-bootstraps it fresh. Exists for two reasons — recovering a
      // channel that's wedged (e.g. an alarm that exhausted its retries
      // and stopped firing, so nothing will ever re-run the code that
      // would otherwise self-heal it) and deliberate dev/testing resets,
      // e.g. on the debug or battle channel. Gated on a bearer-style query
      // token compared against the ADMIN_TOKEN secret; disabled entirely
      // (401 on every request) if that secret was never set.
      const token = url.searchParams.get('token');
      if (!this.env.ADMIN_TOKEN || token !== this.env.ADMIN_TOKEN) {
        return new Response('unauthorized', { status: 401 });
      }
      await this.state.storage.deleteAll();
      await this.ensureStarted(channelId);
      return Response.json(this.payloadFor(await this.getSnapshot()));
    }

    return new Response('not found', { status: 404 });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernatable API: the DO can be evicted from memory between messages
    // while the socket stays attached at the edge. Never track sockets in
    // an in-memory field for broadcast — always read them back via
    // state.getWebSockets(), which survives hibernation.
    this.state.acceptWebSocket(server);
    server.send(JSON.stringify(this.payloadFor(await this.getSnapshot())));

    return new Response(null, { status: 101, webSocket: client });
  }

  /** The Season ring, or [] for a channel that hasn't closed one since
   * this shipped. Absent rather than empty is the normal state for every
   * existing channel, and there is nothing to reconstruct it from — the
   * ring starts filling at the next Season boundary. */
  private async getHistory(): Promise<SeasonSummary[]> {
    return (await this.state.storage.get<SeasonSummary[]>(HISTORY_KEY)) ?? [];
  }

  private async getDevices(): Promise<DeviceRegistration[]> {
    return (await this.state.storage.get<DeviceRegistration[]>(DEVICES_KEY)) ?? [];
  }

  /**
   * The notification budget, loaded once per isolate.
   *
   * A budget restored from storage carries its own seen-set, so a
   * reconnect or an eviction does not re-announce anything that was
   * already offered. What it cannot carry is the distinction notify.ts
   * calls priming: a brand-new budget, on a channel that has been
   * playing for months, must treat whatever is live at this instant as
   * history rather than news. Otherwise the first commit after the
   * feature ships announces a Night that was already half over.
   */
  private async getBudget(snapshot: ChannelSnapshot, now: number): Promise<NotificationBudget> {
    if (this.budget) return this.budget;

    const stored = await this.state.storage.get<NotifyBudgetState>(NOTIFY_KEY);
    this.budget = new NotificationBudget({}, stored);
    if (!stored) {
      this.budget.prime(dramaFor(snapshot), snapshot, now);
      await this.state.storage.put(NOTIFY_KEY, this.budget.toJSON());
    }
    return this.budget;
  }

  /**
   * The all-time record ledger, started at the current Season if this
   * channel has never had one.
   *
   * Opening it at today's Season rather than at Season 1 is the honest
   * move and the only possible one: the coordinator never kept what the
   * biggest lead was across the Seasons before this shipped, so a ledger
   * claiming to cover them would be inventing. `since` carries that, and
   * is also what the first break of each record is weighed against.
   */
  private async getLedger(openAt?: number): Promise<RecordLedger> {
    const stored = await this.state.storage.get<RecordLedger>(RECORDS_KEY);
    if (stored) return stored;
    // `since` is the last Season that had *already* settled when tracking
    // began, so the first Season folded in measures one Season of age
    // rather than nought. The write path passes it explicitly because by
    // then the closing Season has already been credited to the record and
    // reading the total back would count it twice.
    const snapshot = await this.getSnapshot();
    const settled = snapshot.lifetimeRecord.humans + snapshot.lifetimeRecord.demons;
    return emptyLedger(openAt ?? settled, Date.now());
  }

  /**
   * Write a closed Season into the ring, and fold it into the ledger.
   *
   * Called from resolveFlip at the moment the Season is decided, which is
   * the only moment the facts are all in one place: completedWeeks still
   * holds the Week order (beginNextStep clears it a pause later), and the
   * record and run have just been credited. A beat earlier and the record
   * is stale; a beat later and the Weeks are gone.
   *
   * Whatever broke is stamped onto the summary as well as being kept in
   * the ledger, so the digest reads breaks out of the ring it already
   * fetches. A record can only break when a Season closes, which is
   * exactly when the ring gains an entry — one trigger, one fetch, one
   * window.
   */
  private async recordSeason(settled: ChannelSnapshot): Promise<void> {
    const endedAt = Date.now();
    const settledCount = settled.lifetimeRecord.humans + settled.lifetimeRecord.demons;
    const { ledger, breaks } = applySeason(await this.getLedger(settledCount - 1), {
      seasonNumber: settled.seasonNumber,
      record: settled.lifetimeRecord,
      streak: settled.seasonStreak,
      at: endedAt,
    });
    const notable = notableBreaks(breaks);

    const summary: SeasonSummary = {
      seasonNumber: settled.seasonNumber,
      weeks: settled.completedWeeks.map((week) => week.winner),
      weeksPerSeason: settled.weeksPerSeason,
      endedAt,
      record: settled.lifetimeRecord,
      streak: settled.seasonStreak,
      // Only the breaks that mean anything — see notableBreaks. The
      // ledger above took all of them.
      ...(notable.length > 0 ? { records: notable } : {}),
    };

    await this.state.storage.put({
      [HISTORY_KEY]: pushSeason(await this.getHistory(), summary),
      [RECORDS_KEY]: ledger,
    });
  }

  private async getSnapshot(): Promise<ChannelSnapshot> {
    const snapshot = await this.state.storage.get<ChannelSnapshot>(SNAPSHOT_KEY);
    if (!snapshot) throw new Error('channel not started — ensureStarted() should have run first');
    return withDefaults(snapshot);
  }

  /**
   * The wire form: the snapshot plus the drama report derived from it.
   *
   * Every route out of this class goes through here — the REST read, a
   * new socket's first message, and the broadcast after each transition —
   * so no client can be handed a snapshot without the report, and none of
   * them has to work out what a decider is for itself. Derived at the
   * boundary rather than stored, for the reasons on ChannelPayload.
   */
  private payloadFor(snapshot: ChannelSnapshot): ChannelPayload {
    return { ...snapshot, drama: dramaFor(snapshot) };
  }

  private async broadcast(snapshot: ChannelSnapshot): Promise<void> {
    const payload = JSON.stringify(this.payloadFor(snapshot));
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // socket already gone; hibernatable API reaps these on its own
      }
    }
  }

  /** Lazily bootstraps a brand-new channel: Season 1, Week 1, Night 1, first flip pending. */
  private async ensureStarted(channelId: string): Promise<void> {
    const existing = await this.state.storage.get<ChannelSnapshot>(SNAPSHOT_KEY);
    if (existing) return;

    const preset = presetFor(channelId);
    const night = beginNight(preset, 1);
    const initialPhase: GamePhase = preset.autoStart ? 'season_launch' : 'standby';

    const snapshot: ChannelSnapshot = {
      channelId,
      ...this.timestampsFor(channelId, initialPhase),
      seasonNumber: 1,
      weekNumber: 1,
      nightNumber: 1,
      nightsPerWeek: preset.nightsPerWeek,
      weeksPerSeason: preset.weeksPerSeason,
      completedWeeks: [],
      completedNights: [],
      ...night,
      pendingFlip: null, // nothing flipping yet — Season Launch is a countdown, not gameplay
      weekScore: emptyScore(),
      seasonScore: emptyScore(),
      lifetimeRecord: emptyScore(),
      seasonStreak: emptyStreak(),
    };

    await this.commit(snapshot);
  }

  /**
   * Fires when the current phase's phaseEndsAt is reached. Two cases:
   * revealing an in-flight flip (phase === 'flipping'), or advancing out of
   * a pause into whatever comes next (round/night/week/season).
   */
  async alarm(): Promise<void> {
    const snapshot = await this.getSnapshot();

    // Shouldn't happen — commit() never schedules an alarm while in
    // standby — but stay safe rather than falling into beginNextStep()'s
    // default-case throw if one somehow fires late.
    if (snapshot.phase === 'standby') return;

    if (snapshot.phase === 'flipping') {
      await this.resolveFlip(snapshot);
    } else {
      await this.beginNextStep(snapshot);
    }
  }

  /** Reveal the pending flip, apply it via the Family engine, and check for
   * round/night/week/season closure top-down (take-max pause tier). */
  private async resolveFlip(snapshot: ChannelSnapshot): Promise<void> {
    const face = await this.state.storage.get<CoinFace>(PENDING_FACE_KEY);
    if (!face) throw new Error('resolveFlip called with no pending face recorded');

    const outcome = engineFor(snapshot.familyId).applyFlip(snapshot.nightState, snapshot.sheetConfig, face);
    const next: ChannelSnapshot = { ...snapshot, nightState: outcome.state };

    if (!outcome.roundClosed) {
      // Chain straight into the next flip within the same round — no pause
      // between individual flips, matching the printed cadence.
      await this.state.storage.put(PENDING_FACE_KEY, randomFace());
      await this.commit({
        ...next,
        pendingFlip: pendingFlipFor(outcome.state),
        ...this.timestampsFor(snapshot.channelId, 'flipping'),
      });
      return;
    }

    // Round closed — walk the container hierarchy top-down so a single flip
    // that closes multiple containers at once picks the highest (take-max).
    next.pendingFlip = null;

    if (!outcome.nightWinner) {
      next.phase = 'round_resolved';
    } else {
      next.weekScore = addPoints(snapshot.weekScore, outcome.nightWinner, 1);
      next.completedNights = [...snapshot.completedNights, outcome.nightWinner];

      // Best-of: the Week ends the moment either side has a strict
      // majority of nightsPerWeek, not only once every Night has been
      // played — a 7-Night Week can close as early as Night 4. See
      // shared/src/scoring.ts's own doc comment for the full reasoning.
      const weekComplete = isContainerDecided(next.weekScore, snapshot.nightsPerWeek);
      if (!weekComplete) {
        next.phase = 'night_won';
      } else {
        const weekWinner = containerWinner(next.weekScore);
        if (!weekWinner) throw new Error('week completed but scores tied — container size is invalid');
        next.seasonScore = addPoints(snapshot.seasonScore, weekWinner, 1);
        next.completedWeeks = [...snapshot.completedWeeks, { weekNumber: snapshot.weekNumber, winner: weekWinner }];

        const seasonComplete = isContainerDecided(next.seasonScore, snapshot.weeksPerSeason);
        if (!seasonComplete) {
          next.phase = 'week_won';
        } else {
          const seasonWinner = containerWinner(next.seasonScore);
          if (!seasonWinner) throw new Error('season completed but scores tied — container size is invalid');
          next.lifetimeRecord = addPoints(snapshot.lifetimeRecord, seasonWinner, 1);
          // Same winner as last time extends the streak; a new winner resets
          // it to 1 (or starts it, the first time any Season ever closes).
          next.seasonStreak =
            snapshot.seasonStreak.side === seasonWinner
              ? { side: seasonWinner, length: snapshot.seasonStreak.length + 1 }
              : { side: seasonWinner, length: 1 };
          next.phase = 'season_won';
        }
      }
    }

    // Only the round_resolved pause stretches: the Night/Week/Season
    // pauses are already long enough to cover any round's worth of
    // reveals, and they're doing other work (a winner's screen) that
    // shouldn't grow with how many marks happened to land.
    const pauseScale = next.phase === 'round_resolved' ? (outcome.pauseScale ?? 1) : 1;
    Object.assign(next, this.timestampsFor(snapshot.channelId, next.phase, pauseScale));
    await this.commit(next);

    if (next.phase === 'season_won') {
      // After the commit, not before: the snapshot is what every viewer is
      // about to be shown and the ring is read by nobody for at least the
      // length of this pause, so the live path gets the write it's waiting
      // on first. A failure here costs one row of history and leaves the
      // game entirely correct, which is the right way round.
      await this.recordSeason(next);
    }

    // TODO once D1 is wired up: append the flip event, and a Night/Week
    // summary row whenever this closed one of those containers — that's
    // the durable historical archive, separate from this DO's fast working
    // state. Seasons are now also kept here, but only the last
    // HISTORY_LENGTH of them and only to serve the away digest; D1 remains
    // the thing that can answer a question about Season 200.
  }

  /**
   * Advance out of a pause phase into whatever comes next — a fixed
   * table, not runtime-dependent: round_resolved/night_won always chain
   * straight back into gameplay, week_won detours through Season Overview,
   * season_won detours through Season Launch, and both of those launch
   * phases fall through into gameplay once their countdown ends. Every
   * case that starts a new Night (night_won/week_won/season_won) goes
   * through beginNight() to pick that Night's Sheet from the rotation.
   */
  private async beginNextStep(snapshot: ChannelSnapshot): Promise<void> {
    const preset = presetFor(snapshot.channelId);
    let { seasonNumber, weekNumber, nightNumber, weekScore, seasonScore, completedWeeks, completedNights } =
      snapshot;
    let night: ReturnType<typeof beginNight> | null = null;
    let nightState = snapshot.nightState;
    let nextPhase: GamePhase;

    switch (snapshot.phase) {
      case 'round_resolved':
        nightState = engineFor(snapshot.familyId).startNextRound(nightState);
        nextPhase = 'flipping';
        break;
      case 'night_won':
        nightNumber += 1;
        night = beginNight(preset, nightNumber);
        nextPhase = 'flipping';
        break;
      case 'week_won':
        weekNumber += 1;
        nightNumber = 1;
        weekScore = emptyScore();
        completedNights = [];
        night = beginNight(preset, nightNumber);
        nextPhase = 'season_overview';
        break;
      case 'season_won':
        seasonNumber += 1;
        weekNumber = 1;
        nightNumber = 1;
        weekScore = emptyScore();
        seasonScore = emptyScore();
        completedWeeks = [];
        completedNights = [];
        night = beginNight(preset, nightNumber);
        // main rolls straight into the next season, same as always; a
        // non-autoStart channel (debug/battle) waits in standby instead of
        // looping unattended — this is the actual cost fix, not just the
        // bootstrap-time check above.
        nextPhase = preset.autoStart ? 'season_launch' : 'standby';
        break;
      case 'season_launch':
        nextPhase = 'season_overview';
        break;
      case 'season_overview':
        nextPhase = 'flipping';
        break;
      default:
        throw new Error(`beginNextStep called from unexpected phase: ${snapshot.phase}`);
    }

    if (night) {
      nightState = night.nightState;
    }

    const isFlipping = nextPhase === 'flipping';
    if (isFlipping) {
      await this.state.storage.put(PENDING_FACE_KEY, randomFace());
    }

    await this.commit({
      ...snapshot,
      seasonNumber,
      weekNumber,
      nightNumber,
      weekScore,
      seasonScore,
      completedWeeks,
      completedNights,
      ...(night ?? {}), // sheetId/familyId/sheetConfig/sheetStyle/unitCrossOrder, only when a new Night started
      nightState,
      pendingFlip: isFlipping ? pendingFlipFor(nightState) : null,
      ...this.timestampsFor(snapshot.channelId, nextPhase),
    });
  }

  /** `scale` stretches the pause for a round that produced more than one
   * thing to watch (see FlipOutcome.pauseScale) -- a Trifecta round that
   * destroys three targets runs three back-to-back reveals, so it needs
   * three times the beat. Defaults to 1, which is every other phase's
   * behaviour unchanged. */
  private timestampsFor(channelId: string, phase: GamePhase, scale = 1) {
    const now = Date.now();
    const durations = presetFor(channelId).phaseDurationsMs;
    return { phase, phaseStartedAt: now, phaseEndsAt: now + durations[phase] * scale };
  }

  private async commit(snapshot: ChannelSnapshot): Promise<void> {
    await this.state.storage.put(SNAPSHOT_KEY, snapshot);
    // The whole point of standby: no alarm scheduled means the Durable
    // Object does nothing — no cost — until a real request arrives.
    if (snapshot.phase === 'standby') {
      await this.state.storage.deleteAlarm();
    } else {
      await this.state.storage.setAlarm(snapshot.phaseEndsAt);
    }
    await this.broadcast(snapshot);
    await this.notify(snapshot);
  }

  /**
   * Offer this snapshot's drama to the budget, and push whatever it
   * approves.
   *
   * Runs on every commit, so every two seconds, which sounds reckless
   * and is the only correct place for it: drama is a property of a
   * snapshot, and a moment that becomes true between two broadcasts has
   * to be noticed on the broadcast that made it true. The cost of asking
   * is deliberately almost nothing — `consider` drops a moment it has
   * already seen before doing any other work, which is what makes 43,000
   * asks a day resolve into about 1.5 sends.
   *
   * Awaited rather than fired and forgotten. Unawaited work in a Durable
   * Object can be cut short when the object is evicted, and the cost of
   * waiting is a few hundred milliseconds added to one broadcast every
   * sixteen hours or so — against a phase clock whose shortest beat is
   * two seconds, and which is re-derived from absolute timestamps by
   * every client anyway.
   *
   * Nothing in here may throw. A notification is a courtesy; the channel
   * is the product, and Apple being unreachable must never be able to
   * stop a Night.
   */
  private async notify(snapshot: ChannelSnapshot): Promise<void> {
    try {
      const now = Date.now();
      const budget = await this.getBudget(snapshot, now);
      const { sends } = sendsFor(budget, dramaFor(snapshot), snapshot, now, snapshot.channelId);
      if (sends.length === 0) return;

      // Only once something was approved: the budget's seen-set grows on
      // most commits, but what it has *spent* changes about twice a day,
      // and that is the part worth a write.
      await this.state.storage.put(NOTIFY_KEY, budget.toJSON());

      const devices = await this.getDevices();

      // The only way to watch this work before a key exists: `wrangler
      // tail` and wait. Logged whether or not anything is reachable,
      // because "the budget approved a title Night just now" is the
      // thing worth knowing, and it costs a line about twice a day.
      for (const send of sends) {
        console.log(`notify ${send.momentId} "${send.alert.title}" -> ${devices.length} device(s)`);
      }
      if (devices.length === 0) return;

      const jwt = await this.providerToken(now);
      const result = await deliver(sends, devices, (device, alert, expiresAt) =>
        push(jwt, device, alertPayload(alert), expiresAt),
      );

      if (result.retire.length > 0) {
        // Apple only tells you a token is dead by rejecting a send, so
        // this is the one moment the list can be pruned. One write for
        // however many died at once.
        let devices = await this.getDevices();
        for (const token of result.retire) devices = withoutDevice(devices, token);
        await this.state.storage.put(DEVICES_KEY, devices);
      }
    } catch (error) {
      console.error('notify failed', error);
    }
  }

  /** A cached APNs provider token, minted only when there is a key and
   * the last one has aged out. Null means unconfigured, which `push`
   * reports rather than treats as an error. */
  private async providerToken(now: number): Promise<string | null> {
    const credentials = readCredentials(this.env);
    if (!credentials) return null;
    if (!tokenIsFresh(this.apnsToken, now)) {
      this.apnsToken = await mintToken(credentials, now);
    }
    return this.apnsToken.jwt;
  }
}
