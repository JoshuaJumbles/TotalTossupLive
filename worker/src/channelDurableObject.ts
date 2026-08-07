import type { ChannelSnapshot } from '@total-tossup-live/shared';
import { PHASE_DURATIONS_MS } from '@total-tossup-live/shared';

export interface Env {
  CHANNEL: DurableObjectNamespace;
  // DB: D1Database; // enabled once wrangler.toml's d1_databases block is filled in
}

const SNAPSHOT_KEY = 'snapshot';

/**
 * The authoritative live coordinator for one channel. Owns the phase clock
 * (via alarm()), the current Season/Week/Night/Sheet position, and the
 * WebSocket fan-out to every connected viewer. Holds zero knowledge of *how*
 * a Night is won — that's delegated to whichever Family engine the current
 * Sheet names (see shared/src/family.ts) — this class only knows phases,
 * timing, and Night→Week→Season→History bookkeeping.
 *
 * NOTE: this is a scaffold. The tick()/alarm() loop and the bestof Family
 * engine are implemented in a follow-up PR — see README's "Getting started".
 */
export class ChannelDurableObject implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sockets: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/ws')) {
      return this.handleWebSocketUpgrade(request);
    }

    if (url.pathname.endsWith('/snapshot')) {
      const snapshot = await this.getSnapshot();
      return Response.json(snapshot ?? { error: 'not started' });
    }

    return new Response('not found', { status: 404 });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    this.sockets.add(server);

    const snapshot = await this.getSnapshot();
    if (snapshot) {
      server.send(JSON.stringify(snapshot));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.sockets.delete(ws);
  }

  private async getSnapshot(): Promise<ChannelSnapshot | undefined> {
    return this.state.storage.get<ChannelSnapshot>(SNAPSHOT_KEY);
  }

  private async broadcast(snapshot: ChannelSnapshot): Promise<void> {
    const payload = JSON.stringify(snapshot);
    for (const ws of this.sockets) {
      ws.send(payload);
    }
  }

  /**
   * Fires when the current phase's phaseEndsAt is reached. Resolves the
   * phase (Family engine applies the pending flip, checks for round/night/
   * week/season closure top-down, take-max on the resulting pause tier),
   * persists, writes closure events to D1, broadcasts, and schedules the
   * next alarm.
   *
   * TODO: implement — this is the next piece of real feature work.
   */
  async alarm(): Promise<void> {
    // const snapshot = await this.getSnapshot();
    // ... resolve phase via the current Sheet's Family engine ...
    // ... persist + broadcast + this.state.storage.setAlarm(nextPhaseEndsAt) ...
    void PHASE_DURATIONS_MS; // referenced once real tick logic lands
  }
}
