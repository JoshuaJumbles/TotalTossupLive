/**
 * Watches a live channel and runs the notification sender against it
 * without sending anything.
 *
 * The rates in MOMENT_RATES_PER_DAY came out of a 60,000-Season simulation
 * of the scoring and the phase durations, and every weight — and therefore
 * the whole budget — is derived from them. A simulation of your own rules
 * agreeing with itself proves nothing, so before anything reaches a phone
 * this points the real selector at the real channel and writes down what
 * it would have done.
 *
 * What it's actually checking, in order of how much it would cost to get
 * wrong:
 *
 *  - Throughput. The rates are occurrences per *day*, so they all scale
 *    with how many Seasons, Weeks and Nights a day the channel really
 *    gets through. The simulation said about 16, 93 and 541. If that is
 *    off, every weight is off by the same factor and the ordering survives
 *    but the budget doesn't.
 *  - Occurrence counts. Each moment's observed rate against its simulated
 *    one. This is the part a simulation can genuinely get wrong, because
 *    it modelled the phase durations rather than measuring them.
 *  - Where the budget binds. Every refusal is logged with its reason, so
 *    "the threshold did the work" and "the ceiling kept turning away good
 *    moments" are distinguishable afterwards rather than a matter of
 *    opinion.
 *  - The copy. Every send is logged with the sentence it would have sent,
 *    against a real situation rather than a fixture.
 *
 * Reads only. The one thing it can't take from the wire is completedNights
 * — production predates that field — so it reconstructs the order from the
 * Night wins it watches land. See trackNights().
 *
 *   npm run probe --workspace=worker
 *   npm run probe --workspace=worker -- --url ws://localhost:8788/channels/debug/ws
 */

import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChannelSnapshot, DramaInput, MomentId, NotifyPolicy, Side } from '../../shared/src/index';
import {
  MOMENT_RATES_PER_DAY,
  NotificationBudget,
  dramaFor,
  momentCopy,
} from '../../shared/src/index';

const DAY_MS = 24 * 60 * 60 * 1000;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const url = arg('url', 'wss://api.totaltossup.live/channels/main/ws');
const outDir = arg('out', join(process.cwd(), '.probe'));
const summaryEveryMs = Number(arg('summary-every', '60')) * 1000;

/**
 * Policy overrides, so a run can be asked a different question than "what
 * would the shipped defaults have done".
 *
 * Mainly for the fast debug channel, where the real 30-minute cooldown
 * means an hour of watching shows one send and proves nothing about the
 * gates behind it. Whatever is set gets printed at the top of the summary,
 * because a rate measured under a changed policy is not a rate measured
 * under the shipped one.
 */
const overrides: Partial<NotifyPolicy> = {};
if (process.argv.includes('--floor')) overrides.weightFloor = Number(arg('floor', '6.5'));
if (process.argv.includes('--budget')) overrides.budgetPerDay = Number(arg('budget', '3'));
if (process.argv.includes('--cooldown-min')) {
  overrides.cooldownMs = Number(arg('cooldown-min', '30')) * 60 * 1000;
}

mkdirSync(outDir, { recursive: true });
const eventsPath = join(outDir, 'notify-probe.ndjson');
const summaryPath = join(outDir, 'notify-probe.txt');

const budget = new NotificationBudget(overrides);
/** Set when the first snapshot lands rather than at launch, so the per-day
 * figures divide by time actually spent watching. */
let startedAt = Date.now();
let primed = false;

/** Counts of distinct occurrences, keyed by moment. */
const occurrences = new Map<MomentId, number>();
const refusals = new Map<string, number>();
const sends: { at: number; id: MomentId; title: string; body: string; season: number }[] = [];

let snapshots = 0;
let nightsSeen = 0;
let weeksSeen = 0;
let seasonsSeen = 0;
/** Nights whose order we never saw, because we joined partway through a
 * Week or missed messages across a reconnect. A comeback can't be detected
 * in such a Week, so the one it affects is counted and excluded rather
 * than guessed at. */
let partialWeeks = 0;

let prev: ChannelSnapshot | null = null;
let completedNights: Side[] = [];
let weekIsPartial = true;

const bump = <K>(map: Map<K, number>, key: K) => map.set(key, (map.get(key) ?? 0) + 1);
const log = (row: unknown) => appendFileSync(eventsPath, `${JSON.stringify(row)}\n`);

/**
 * Rebuild this Week's Night winners in order by watching the Week score
 * move, since the deployed coordinator doesn't carry the field yet.
 *
 * A Night landing shows up as the Week score gaining exactly one point on
 * one side; a new Week shows up as it going back to nothing. Anything else
 * — a jump of more than one, or a first sight of a Week already in
 * progress — means we don't know the order, and the Week is flagged
 * partial so that nothing claims a comeback it can't actually see.
 */
function trackNights(snapshot: ChannelSnapshot): void {
  const played = snapshot.weekScore.humans + snapshot.weekScore.demons;

  if (!prev) {
    // First sight of the channel, or the first after a reconnect. Joining
    // at a Week boundary costs nothing; joining partway through one means
    // this Week's order is lost.
    completedNights = [];
    if (played > 0 && !weekIsPartial) partialWeeks += 1;
    weekIsPartial = played > 0;
    return;
  }

  const was = prev.weekScore.humans + prev.weekScore.demons;
  if (played === was) return;

  if (played < was) {
    // The Week score only ever resets, never falls — a new Week has begun.
    completedNights = [];
    weekIsPartial = false;
    return;
  }

  if (played === was + 1) {
    const winner: Side =
      snapshot.weekScore.humans > prev.weekScore.humans ? 'humans' : 'demons';
    completedNights = [...completedNights, winner];
    nightsSeen += 1;
    return;
  }

  // More than one Night in a single step: messages were missed.
  nightsSeen += played - was;
  completedNights = [];
  if (!weekIsPartial) partialWeeks += 1;
  weekIsPartial = true;
}

function inputFor(snapshot: ChannelSnapshot): DramaInput {
  const played = snapshot.weekScore.humans + snapshot.weekScore.demons;
  // Prefer the server's own order once it starts sending one, but only
  // when it's actually complete — a channel deployed mid-Week backfills to
  // [] and would otherwise look authoritative while being empty.
  const fromServer = snapshot.completedNights;
  const order = fromServer && fromServer.length === played ? fromServer : completedNights;
  return { ...snapshot, completedNights: order.length === played ? order : [] };
}

function onSnapshot(snapshot: ChannelSnapshot): void {
  const now = Date.now();
  snapshots += 1;

  if (prev) {
    if (snapshot.completedWeeks.length > prev.completedWeeks.length) weeksSeen += 1;
    const record = snapshot.lifetimeRecord.humans + snapshot.lifetimeRecord.demons;
    const before = prev.lifetimeRecord.humans + prev.lifetimeRecord.demons;
    if (record > before) seasonsSeen += 1;
  }

  trackNights(snapshot);
  const input = inputFor(snapshot);
  prev = snapshot;

  const report = dramaFor(input);

  if (!primed) {
    // Whatever is live on arrival began before we were watching, so it
    // isn't an occurrence we can count or a notification we could honestly
    // have sent. Taken as history; the clock starts here.
    primed = true;
    startedAt = now;
    budget.prime(report, input, now);
    log({
      at: new Date(now).toISOString(),
      event: 'primed',
      alreadyLive: report.moments.map((m) => m.id),
      season: snapshot.seasonNumber,
      week: snapshot.weekNumber,
      night: snapshot.nightNumber,
    });
    return;
  }
  for (const candidate of budget.consider(report, input, now)) {
    bump(occurrences, candidate.moment.id);
    const copy = momentCopy(candidate.moment, input);
    log({
      at: new Date(now).toISOString(),
      verdict: candidate.verdict,
      id: candidate.moment.id,
      weight: Number(candidate.moment.weight.toFixed(3)),
      threshold: Number(candidate.threshold.toFixed(3)),
      side: candidate.moment.side,
      key: candidate.key,
      phase: snapshot.phase,
      season: snapshot.seasonNumber,
      week: snapshot.weekNumber,
      night: snapshot.nightNumber,
      weekScore: snapshot.weekScore,
      seasonScore: snapshot.seasonScore,
      lifetimeRecord: snapshot.lifetimeRecord,
      weekIsPartial,
      title: copy.title,
      body: copy.body,
    });
    if (candidate.verdict === 'send') {
      sends.push({
        at: now,
        id: candidate.moment.id,
        title: copy.title,
        body: copy.body,
        season: snapshot.seasonNumber,
      });
    } else {
      bump(refusals, candidate.verdict);
    }
  }
}

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function padStart(s: string, n: number) {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function summary(): string {
  const elapsedMs = Date.now() - startedAt;
  const perDay = (n: number) => (n * DAY_MS) / Math.max(elapsedMs, 1);
  const hours = elapsedMs / (60 * 60 * 1000);
  const lines: string[] = [];

  lines.push(`notify probe — ${url}`);
  if (Object.keys(overrides).length > 0) {
    lines.push(`POLICY OVERRIDDEN: ${JSON.stringify(overrides)} — rates below are not the shipped policy's`);
  }
  lines.push(`watching for ${hours.toFixed(2)}h, ${snapshots} snapshots`);
  lines.push(`last seen: ${prev ? `Season ${prev.seasonNumber}, Week ${prev.weekNumber}, Night ${prev.nightNumber} (${prev.phase}), record ${prev.lifetimeRecord.humans}-${prev.lifetimeRecord.demons}` : '—'}`);
  lines.push('');

  // Throughput first: every rate below is a per-day figure, so they all
  // move together with this.
  lines.push('throughput        observed/day   simulated/day');
  const sim: [string, number, number][] = [
    ['Seasons', seasonsSeen, 16],
    ['Weeks', weeksSeen, 93],
    ['Nights', nightsSeen, 541],
  ];
  for (const [name, seen, expected] of sim) {
    lines.push(
      `  ${pad(name, 14)} ${padStart(perDay(seen).toFixed(1), 8)} (${seen})  ${padStart(String(expected), 8)}   x${(perDay(seen) / expected).toFixed(2)}`,
    );
  }
  lines.push('');

  // MOMENT_RATES_PER_DAY was measured on the main preset and nothing else,
  // so against any other container sizes the comparison column is noise.
  const onMainPreset = !prev || (prev.nightsPerWeek === 7 && prev.weeksPerSeason === 7);
  if (!onMainPreset) {
    lines.push(
      `NOT THE MAIN PRESET (${prev!.nightsPerWeek} Nights per Week, ${prev!.weeksPerSeason} Weeks per Season)`,
    );
    lines.push('— the simulated rates are main-preset figures, so ignore the comparison below.');
  }
  lines.push('moment                   seen   obs/day   sim/day    ratio');
  const ids = (Object.keys(MOMENT_RATES_PER_DAY) as MomentId[]).sort(
    (a, b) => MOMENT_RATES_PER_DAY[b] - MOMENT_RATES_PER_DAY[a],
  );
  for (const id of ids) {
    const seen = occurrences.get(id) ?? 0;
    const obs = perDay(seen);
    const expected = MOMENT_RATES_PER_DAY[id];
    lines.push(
      `  ${pad(id, 22)} ${padStart(String(seen), 5)} ${padStart(obs.toFixed(2), 9)} ${padStart(expected.toFixed(2), 9)} ${padStart(seen === 0 ? '—' : `x${(obs / expected).toFixed(2)}`, 8)}`,
    );
  }
  lines.push('');
  if (partialWeeks > 0) {
    lines.push(`(${partialWeeks} Week(s) had an unknown Night order, so no comeback could be seen in them)`);
    lines.push('');
  }

  lines.push(`threshold now: ${budget.thresholdAt(Date.now()).toFixed(3)} bits`);
  lines.push(`sends: ${sends.length} (${perDay(sends.length).toFixed(2)}/day, budget ${budget.policy.budgetPerDay}/day)`);
  for (const [reason, count] of [...refusals].sort((a, b) => b[1] - a[1])) {
    lines.push(`  refused, ${pad(reason, 16)} ${count}`);
  }
  lines.push('');
  if (sends.length > 0) {
    lines.push('what it would have sent:');
    for (const send of sends.slice(-25)) {
      lines.push(`  ${new Date(send.at).toISOString().slice(11, 19)}  [${send.id}] S${send.season}`);
      lines.push(`    ${send.title}`);
      lines.push(`    ${send.body}`);
    }
  }
  return lines.join('\n') + '\n';
}

function writeSummary() {
  writeFileSync(summaryPath, summary());
}

let socket: WebSocket | null = null;
let backoffMs = 1000;

function connect() {
  socket = new WebSocket(url);

  socket.addEventListener('open', () => {
    backoffMs = 1000;
    log({ at: new Date().toISOString(), event: 'connected', url });
  });

  socket.addEventListener('message', (event) => {
    try {
      onSnapshot(JSON.parse(String(event.data)) as ChannelSnapshot);
    } catch (error) {
      log({ at: new Date().toISOString(), event: 'bad-message', error: String(error) });
    }
  });

  socket.addEventListener('close', () => {
    log({ at: new Date().toISOString(), event: 'disconnected', retryInMs: backoffMs });
    // A reconnect means an unknown number of missed Nights; trackNights
    // works out from the next snapshot whether the Week in progress is
    // still trustworthy.
    prev = null;
    setTimeout(connect, backoffMs);
    backoffMs = Math.min(backoffMs * 2, 60_000);
  });

  socket.addEventListener('error', () => {
    /* close follows; handled there */
  });
}

process.on('SIGINT', () => {
  writeSummary();
  process.stdout.write(summary());
  process.exit(0);
});

connect();
setInterval(writeSummary, summaryEveryMs);
writeSummary();
process.stdout.write(`probe running — ${eventsPath}\n            — ${summaryPath}\n`);
