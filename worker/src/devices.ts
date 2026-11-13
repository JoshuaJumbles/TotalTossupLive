/**
 * Who to wake, for one channel.
 *
 * ## Why this is Durable Object storage and not D1
 *
 * wrangler.toml has had a commented-out D1 binding since before any of
 * this existed, described there as the durable event log — flips, and
 * Night/Week/Season summaries. A device token is not that. It is a small
 * mutable set, read at exactly the moment the send decision is made,
 * scoped to exactly one channel, and the send decision already happens
 * inside the channel's own Durable Object. Putting the list anywhere else
 * means a second round trip on the one path that cannot afford one.
 *
 * It is also the correctly shaped model rather than merely the convenient
 * one. A token identifies a device-and-app; a *subscription* is to a
 * channel; and "the devices watching this channel" is the question the
 * sender asks. One list per channel answers it directly.
 *
 * Where that stops working, so it is a known edge and not a surprise:
 *
 *  - The reverse question. "Which channels is this device subscribed to"
 *    requires a scan of every channel, which is fine at one channel and
 *    not at fifty. The day a settings screen needs that answer, the index
 *    belongs in D1 and this list stays as the sender's fast path.
 *  - Volume. This is a single stored value, so every registration
 *    rewrites the whole list. Fine into the low thousands; past that the
 *    tokens want to be individual keys, or rows.
 *
 * ## Tokens expire, and only Apple knows when
 *
 * A device token is not forever: it changes when an app is restored to a
 * new device, and it is retired when the app is deleted. Apple tells you
 * by rejecting a send with 410 Unregistered, which means the only way to
 * learn a token is dead is to try it. So `forget` exists to be called
 * from the sender's failure path, and the list prunes itself by being
 * used rather than on a schedule.
 */

export interface DeviceRegistration {
  /** The APNs device token, lowercase hex. */
  token: string;
  /** Which APNs environment issued it. A token from a development build
   * is rejected by the production host and vice versa, with the same
   * unhelpful BadDeviceToken either way, so each one has to remember
   * where it came from. */
  environment: 'sandbox' | 'production';
  /** The app's bundle id, which APNs wants as `apns-topic`. Carried per
   * device rather than configured once so that a future extension or a
   * second app against the same channel does not need a second code
   * path. */
  topic: string;
  registeredAt: number;
}

/** Hex, and APNs tokens are 32 bytes — but Apple has changed the length
 * before, so this checks the shape and a sane range rather than pinning a
 * digit that would reject a valid future token. */
const TOKEN_PATTERN = /^[0-9a-f]{32,200}$/;

/** A bundle id: dot-separated alphanumeric labels, optionally with a
 * suffix like `.voip`. Validated because it goes into a request header. */
const TOPIC_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*(\.[A-Za-z0-9][A-Za-z0-9-]*)+$/;

/**
 * Read a registration a client posted, or null if it isn't one.
 *
 * The token and topic are checked against patterns because both are
 * interpolated into an outbound HTTP request — the token into the path,
 * the topic into a header — and a client is the one party here that
 * cannot be assumed to be this project's own code.
 */
export function readRegistration(body: unknown, now: number): DeviceRegistration | null {
  if (typeof body !== 'object' || body === null) return null;
  const { token, environment, topic } = body as Record<string, unknown>;

  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token.toLowerCase())) return null;
  if (typeof topic !== 'string' || !TOPIC_PATTERN.test(topic)) return null;
  if (environment !== 'sandbox' && environment !== 'production') return null;

  return { token: token.toLowerCase(), environment, topic, registeredAt: now };
}

/**
 * Add a registration, replacing any earlier one for the same token.
 *
 * Replacing rather than ignoring is the point: a device re-registers on
 * every launch, and the thing most likely to have changed is which
 * environment it is running under — a build that was sideloaded from
 * Xcode yesterday and from TestFlight today keeps its token and changes
 * its APNs host. Keeping the first answer would send every push for that
 * device to the wrong one of Apple's two servers, forever.
 */
export function withDevice(
  devices: DeviceRegistration[],
  device: DeviceRegistration,
): DeviceRegistration[] {
  return [...devices.filter((each) => each.token !== device.token), device];
}

/** Drop a token, for the sender's 410 path. */
export function withoutDevice(
  devices: DeviceRegistration[],
  token: string,
): DeviceRegistration[] {
  return devices.filter((each) => each.token !== token.toLowerCase());
}
