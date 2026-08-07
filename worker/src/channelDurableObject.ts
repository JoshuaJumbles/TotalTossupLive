import type { BestOfNightState, ChannelSnapshot, CoinFace, GamePhase } from '@total-tossup-live/shared';
import {
  addPoints,
  containerWinner,
  emptyScore,
  isValidContainerSize,
  PHASE_DURATIONS_MS,
  pointValueForPosition,
} from '@total-tossup-live/shared';
import { bestOfEngine } from './families/bestof';
import { DEBUG_SHEET, DEBUG_SHEET_CONFIG, NIGHTS_PER_WEEK, WEEKS_PER_SEASON } from './sheets';

export interface Env {
  CHANNEL: DurableObjectNamespace;
  // DB: D1Database; // enabled once wrangler.toml's d1_databases block is filled in
  ADMIN_TOKEN?: string; // set via `wrangler secret put ADMIN_TOKEN`; /reset is disabled without it
}

const SNAPSHOT_KEY = 'snapshot';
const PENDING_FACE_KEY = 'pendingFace';

function randomFace(): CoinFace {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

function pendingFlipFor(nightState: BestOfNightState) {
  return { sequenceIndex: nightState.currentRound.flips.length, face: null, winner: null };
}

/**
 * Backfills fields that an older persisted snapshot may be missing —
 * Durable Object storage survives code deploys, so a channel that's been
 * running since before ChannelSnapshot grew a field (completedWeeks,
 * nightsPerWeek, weeksPerSeason all landed after the first production
 * deploy) keeps that field absent forever unless something fills it in.
 * Applied once at the read boundary; every mutation path re-persists the
 * full object via commit(), so a channel self-heals to the complete shape
 * after its very next phase transition — no separate migration step
 * needed. Without this, e.g. `[...snapshot.completedWeeks]` throws the
 * instant a week actually completes on an old channel.
 */
function withDefaults(snapshot: ChannelSnapshot): ChannelSnapshot {
  return {
    ...snapshot,
    completedWeeks: snapshot.completedWeeks ?? [],
    nightsPerWeek: snapshot.nightsPerWeek ?? NIGHTS_PER_WEEK,
    weeksPerSeason: snapshot.weeksPerSeason ?? WEEKS_PER_SEASON,
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
 * Clients never receive "do this now" events — every broadcast is a full
 * ChannelSnapshot with absolute phaseStartedAt/phaseEndsAt timestamps, so
 * any viewer (new or reconnecting) can render in sync purely from that plus
 * their local clock.
 */
export class ChannelDurableObject implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Dogfood our own tie-proof at boot: fail loudly rather than silently
    // allow a container size that makes a tie possible.
    if (!isValidContainerSize(NIGHTS_PER_WEEK) || !isValidContainerSize(WEEKS_PER_SEASON)) {
      throw new Error('NIGHTS_PER_WEEK/WEEKS_PER_SEASON must satisfy isValidContainerSize (N mod 4 in {1,2})');
    }
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
      return Response.json(await this.getSnapshot(), {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (url.pathname.endsWith('/reset') && request.method === 'POST') {
      // Minimal admin escape hatch: wipes this channel's storage and
      // re-bootstraps it fresh. Exists for two reasons — recovering a
      // channel that's wedged (e.g. an alarm that exhausted its retries
      // and stopped firing, so nothing will ever re-run the code that
      // would otherwise self-heal it) and, later, deliberate dev/testing
      // resets. Gated on a bearer-style query token compared against the
      // ADMIN_TOKEN secret; disabled entirely (401 on every request) if
      // that secret was never set.
      const token = url.searchParams.get('token');
      if (!this.env.ADMIN_TOKEN || token !== this.env.ADMIN_TOKEN) {
        return new Response('unauthorized', { status: 401 });
      }
      await this.state.storage.deleteAll();
      await this.ensureStarted(channelId);
      return Response.json(await this.getSnapshot());
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
    server.send(JSON.stringify(await this.getSnapshot()));

    return new Response(null, { status: 101, webSocket: client });
  }

  private async getSnapshot(): Promise<ChannelSnapshot> {
    const snapshot = await this.state.storage.get<ChannelSnapshot>(SNAPSHOT_KEY);
    if (!snapshot) throw new Error('channel not started — ensureStarted() should have run first');
    return withDefaults(snapshot);
  }

  private async broadcast(snapshot: ChannelSnapshot): Promise<void> {
    const payload = JSON.stringify(snapshot);
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

    const nightState = bestOfEngine.initNight(DEBUG_SHEET_CONFIG);

    const snapshot: ChannelSnapshot = {
      channelId,
      ...this.timestampsFor('season_launch'),
      seasonNumber: 1,
      weekNumber: 1,
      nightNumber: 1,
      nightsPerWeek: NIGHTS_PER_WEEK,
      weeksPerSeason: WEEKS_PER_SEASON,
      completedWeeks: [],
      sheetId: DEBUG_SHEET.id,
      familyId: DEBUG_SHEET.familyId,
      sheetConfig: DEBUG_SHEET_CONFIG,
      nightState,
      pendingFlip: null, // nothing flipping yet — Season Launch is a countdown, not gameplay
      weekScore: emptyScore(),
      seasonScore: emptyScore(),
      lifetimeRecord: emptyScore(),
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

    const outcome = bestOfEngine.applyFlip(snapshot.nightState, DEBUG_SHEET_CONFIG, face);
    const next: ChannelSnapshot = { ...snapshot, nightState: outcome.state };

    if (!outcome.roundClosed) {
      // Chain straight into the next flip within the same round — no pause
      // between individual flips, matching the printed cadence.
      await this.state.storage.put(PENDING_FACE_KEY, randomFace());
      await this.commit({
        ...next,
        pendingFlip: pendingFlipFor(outcome.state),
        ...this.timestampsFor('flipping'),
      });
      return;
    }

    // Round closed — walk the container hierarchy top-down so a single flip
    // that closes multiple containers at once picks the highest (take-max).
    next.pendingFlip = null;

    if (!outcome.nightWinner) {
      next.phase = 'round_resolved';
    } else {
      next.weekScore = addPoints(snapshot.weekScore, outcome.nightWinner, pointValueForPosition(snapshot.nightNumber));

      const weekComplete = snapshot.nightNumber === NIGHTS_PER_WEEK;
      if (!weekComplete) {
        next.phase = 'night_won';
      } else {
        const weekWinner = containerWinner(next.weekScore);
        if (!weekWinner) throw new Error('week completed but scores tied — container size is invalid');
        next.seasonScore = addPoints(snapshot.seasonScore, weekWinner, pointValueForPosition(snapshot.weekNumber));
        next.completedWeeks = [...snapshot.completedWeeks, { weekNumber: snapshot.weekNumber, winner: weekWinner }];

        const seasonComplete = snapshot.weekNumber === WEEKS_PER_SEASON;
        if (!seasonComplete) {
          next.phase = 'week_won';
        } else {
          const seasonWinner = containerWinner(next.seasonScore);
          if (!seasonWinner) throw new Error('season completed but scores tied — container size is invalid');
          next.lifetimeRecord = addPoints(snapshot.lifetimeRecord, seasonWinner, 1);
          next.phase = 'season_won';
        }
      }
    }

    Object.assign(next, this.timestampsFor(next.phase));
    await this.commit(next);

    // TODO once D1 is wired up: append the flip event, and a Night/Week/
    // Season summary row whenever this closed one of those containers —
    // that's the durable historical archive, separate from this DO's fast
    // working state.
  }

  /**
   * Advance out of a pause phase into whatever comes next — a fixed
   * table, not runtime-dependent: round_resolved/night_won always chain
   * straight back into gameplay, week_won detours through Season Overview,
   * season_won detours through Season Launch, and both of those launch
   * phases fall through into gameplay once their countdown ends.
   */
  private async beginNextStep(snapshot: ChannelSnapshot): Promise<void> {
    let { seasonNumber, weekNumber, nightNumber, weekScore, seasonScore, completedWeeks } = snapshot;
    let nightState = snapshot.nightState;
    let nextPhase: GamePhase;

    switch (snapshot.phase) {
      case 'round_resolved':
        nightState = bestOfEngine.startNextRound(nightState);
        nextPhase = 'flipping';
        break;
      case 'night_won':
        nightNumber += 1;
        nightState = bestOfEngine.initNight(DEBUG_SHEET_CONFIG);
        nextPhase = 'flipping';
        break;
      case 'week_won':
        weekNumber += 1;
        nightNumber = 1;
        weekScore = emptyScore();
        nightState = bestOfEngine.initNight(DEBUG_SHEET_CONFIG);
        nextPhase = 'season_overview';
        break;
      case 'season_won':
        seasonNumber += 1;
        weekNumber = 1;
        nightNumber = 1;
        weekScore = emptyScore();
        seasonScore = emptyScore();
        completedWeeks = [];
        nightState = bestOfEngine.initNight(DEBUG_SHEET_CONFIG);
        nextPhase = 'season_launch';
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
      nightState,
      pendingFlip: isFlipping ? pendingFlipFor(nightState) : null,
      ...this.timestampsFor(nextPhase),
    });
  }

  private timestampsFor(phase: GamePhase) {
    const now = Date.now();
    return { phase, phaseStartedAt: now, phaseEndsAt: now + PHASE_DURATIONS_MS[phase] };
  }

  private async commit(snapshot: ChannelSnapshot): Promise<void> {
    await this.state.storage.put(SNAPSHOT_KEY, snapshot);
    await this.state.storage.setAlarm(snapshot.phaseEndsAt);
    await this.broadcast(snapshot);
  }
}
