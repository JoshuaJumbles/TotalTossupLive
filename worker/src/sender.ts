import type {
  DramaInput,
  DramaReport,
  MomentId,
  NotificationBudget,
  NotifyCandidate,
} from '@total-tossup-live/shared';
import { MOMENT_SCOPES, momentCopy } from '@total-tossup-live/shared';
import type { ApnsAlert, ApnsOutcome } from './apns';
import type { DeviceRegistration } from './devices';

/**
 * The last step: turning a moment the budget approved into a phone
 * buzzing.
 *
 * Everything above this was already built and measured — drama.ts says
 * what is at stake, notify.ts decides which of it is worth an
 * interruption and holds the rate at about 1.5 a day, dramaCopy.ts says
 * how it reads. This module owns only what was missing: addressing, and
 * when a notification stops being worth delivering.
 *
 * Split into a pure half and an effectful one for the same reason
 * applySeason is pure — the decision is the part worth testing, and it
 * should be testable without a Durable Object, a network, or Apple.
 */

/**
 * How long a moment stays worth delivering, by the container it is about.
 *
 * This is the one genuinely new judgement here, and it comes from the
 * shape of what gets pushed: every criterion in drama.ts is
 * *prospective*. "The Night on now decides the Season" is an invitation
 * to come and watch. Delivered twenty minutes later it is not a late
 * notification, it is a false one — the thing it invited you to is over
 * and someone has already won. A phone that was off is better served by
 * silence.
 *
 * So each moment carries an APNs expiration, and Apple drops it rather
 * than queuing it. The windows are the measured durations of the
 * containers themselves on the main channel — 560 Nights, 99 Weeks and
 * 16.6 Seasons a day, so 2.6 minutes, 15 minutes and 87 minutes — taken
 * whole rather than halved, since a moment usually becomes true partway
 * through its container and a window that is slightly generous costs a
 * notification that is slightly stale, while one that is slightly mean
 * costs the notification entirely.
 *
 * Measured on the main preset, and therefore wrong on the debug preset,
 * which plays 3/3 instead of 7/7. That only matters for how long a
 * stale push lingers on a test device, which is why it is a constant
 * here rather than a per-preset table nobody would keep true.
 */
const SCOPE_LIFETIME_MS: Record<'night' | 'week' | 'season', number> = {
  night: 3 * 60 * 1000,
  week: 15 * 60 * 1000,
  season: 90 * 60 * 1000,
};

export interface PendingSend {
  /** The occurrence key, carried through so a log can be reconciled with
   * the budget's own record of what it approved. */
  key: string;
  momentId: MomentId;
  alert: ApnsAlert;
  expiresAt: number;
}

/**
 * What to send, if anything.
 *
 * Pure, and it mutates only the budget it was handed — which is the one
 * thing here that genuinely has to be remembered rather than recomputed,
 * and which the caller is responsible for persisting afterwards.
 *
 * The candidates come back alongside the sends because the refusals are
 * the diagnostic worth having: a log where `budget_spent` keeps appearing
 * against good moments means the threshold is set too low and is spending
 * the day's attention early. See NotificationBudget.rule.
 */
export function sendsFor(
  budget: NotificationBudget,
  report: DramaReport,
  input: DramaInput,
  now: number,
  channelId: string,
): { sends: PendingSend[]; candidates: NotifyCandidate[] } {
  const candidates = budget.consider(report, input, now);
  const sends = candidates
    .filter((candidate) => candidate.verdict === 'send')
    .map((candidate) => {
      const copy = momentCopy(candidate.moment, input);
      return {
        key: candidate.key,
        momentId: candidate.moment.id,
        alert: {
          title: copy.title,
          body: copy.body,
          // One stack per channel. Several pushes about the same channel
          // should collapse on the lock screen rather than form a column
          // of near-identical cards.
          threadId: `channel:${channelId}`,
          data: {
            channelId,
            momentId: candidate.moment.id,
            side: candidate.moment.side,
            seasonNumber: input.seasonNumber,
            weekNumber: input.weekNumber,
          },
        },
        expiresAt: now + SCOPE_LIFETIME_MS[MOMENT_SCOPES[candidate.moment.id]],
      };
    });

  return { sends, candidates };
}

export interface DeliveryResult {
  sent: number;
  /** Tokens Apple says are dead, for the caller to drop. Returned rather
   * than acted on here so that this stays a function of its arguments and
   * the single storage write stays with the caller. */
  retire: string[];
  failures: { token: string; code: number; reason: string }[];
}

/**
 * Fan one batch out across the registered devices.
 *
 * `send` is injected so the whole path is exercisable against a fake —
 * and so the Durable Object can hold the provider-token cache, which it
 * must, because that token may not be re-minted more than once every
 * twenty minutes and module-level state in a hibernating object would
 * not respect that.
 *
 * Every device is attempted even if some fail: one dead token must not
 * cost the rest of the channel its notification. Sent in parallel
 * because a send is a round trip to Apple and there are up to three of
 * them going to every device at once.
 */
export async function deliver(
  sends: PendingSend[],
  devices: DeviceRegistration[],
  send: (
    device: DeviceRegistration,
    alert: ApnsAlert,
    expiresAt: number,
  ) => Promise<ApnsOutcome>,
): Promise<DeliveryResult> {
  const result: DeliveryResult = { sent: 0, retire: [], failures: [] };
  if (sends.length === 0 || devices.length === 0) return result;

  const attempts = devices.flatMap((device) =>
    sends.map(async (pending) => ({
      device,
      outcome: await send(device, pending.alert, pending.expiresAt).catch(
        (error): ApnsOutcome => ({
          status: 'failed',
          code: 0,
          reason: error instanceof Error ? error.message : 'threw',
        }),
      ),
    })),
  );

  for (const { device, outcome } of await Promise.all(attempts)) {
    switch (outcome.status) {
      case 'sent':
        result.sent += 1;
        break;
      case 'unregistered':
        // Deduped: a device with three pushes in flight reports its own
        // death three times, and retiring it once is enough.
        if (!result.retire.includes(device.token)) result.retire.push(device.token);
        break;
      case 'failed':
        result.failures.push({ token: device.token, code: outcome.code, reason: outcome.reason });
        break;
      case 'unconfigured':
        // No key yet. The decision path ran and the budget was spent,
        // which is the behaviour this is meant to have before the
        // credential exists — see apns.ts.
        break;
    }
  }

  return result;
}
