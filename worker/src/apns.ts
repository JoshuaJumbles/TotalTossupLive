/**
 * Talking to Apple.
 *
 * Token-based APNs: a short-lived ES256 JWT signed with a .p8 key from
 * the developer account, sent as a bearer token on an HTTP/2 POST to
 * `/3/device/<token>`. Workers can do all of it — `crypto.subtle` signs
 * ECDSA P-256, and `fetch` negotiates HTTP/2 to Apple without being asked
 * — so there is no library here and no Node shim.
 *
 * ## Unconfigured is a supported state, not an error
 *
 * The key is a secret that has to be minted by hand in the developer
 * portal, and nothing else in this project needs one. So the sender
 * builds its payloads, spends its budget and writes its log whether or
 * not a key exists, and `push` simply reports `unconfigured` when there
 * is nothing to sign with. That keeps the whole decision path live and
 * testable before the credential lands, and it means turning it on later
 * is three `wrangler secret put` calls and no code change.
 *
 * ## The JWT has to be reused
 *
 * Apple is explicit that a provider token may not be regenerated more
 * often than once every 20 minutes, and will start rejecting with
 * TooManyProviderTokenUpdates if it is. Tokens are good for an hour. So
 * one is minted, cached in the caller's hands, and reused — which is why
 * `mintToken` is separate from `push` and why the caller owns the cache
 * rather than this module holding module-level state that a hibernating
 * Durable Object would lose at a different rate than Apple's clock.
 */

export interface ApnsCredentials {
  /** The .p8 private key, PEM, exactly as downloaded. */
  key: string;
  /** The 10-character Key ID the portal shows beside the key. */
  keyId: string;
  /** The 10-character Team ID. */
  teamId: string;
}

export interface ApnsToken {
  jwt: string;
  mintedAt: number;
}

/** Apple's ceiling is one hour; this refreshes comfortably inside it and
 * comfortably outside the 20-minute floor. */
const TOKEN_LIFETIME_MS = 45 * 60 * 1000;

const HOSTS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const;

export type ApnsOutcome =
  | { status: 'sent' }
  /** Apple says this token is dead — the app was deleted or restored.
   * The only way to learn this is to try, so the caller prunes here. */
  | { status: 'unregistered' }
  /** No credentials. Not a failure: see the module comment. */
  | { status: 'unconfigured' }
  | { status: 'failed'; code: number; reason: string };

/** Read credentials out of the environment, or null when the key has not
 * been set. Env values are strings, so the PEM arrives with its newlines
 * intact only if `wrangler secret put` was given the file; a key pasted
 * as one line with literal \n is repaired here rather than failing deep
 * inside importKey with an unreadable DOMException. */
export function readCredentials(env: {
  APNS_KEY?: string;
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
}): ApnsCredentials | null {
  const { APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID } = env;
  if (!APNS_KEY || !APNS_KEY_ID || !APNS_TEAM_ID) return null;
  return {
    key: APNS_KEY.includes('\\n') ? APNS_KEY.replace(/\\n/g, '\n') : APNS_KEY,
    keyId: APNS_KEY_ID,
    teamId: APNS_TEAM_ID,
  };
}

/** base64url, which is what JWS wants and what btoa does not give. */
function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** The DER body of a PEM block, whatever the label and line wrapping. */
function pemBody(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * A fresh provider token.
 *
 * WebCrypto's ECDSA signature is already the raw r‖s pair that JWS ES256
 * specifies, so unlike most JWT code written against Node this needs no
 * DER unwrapping — a detail worth stating because getting it wrong
 * produces a token Apple rejects as malformed with no further hint.
 */
export async function mintToken(credentials: ApnsCredentials, now: number): Promise<ApnsToken> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBody(credentials.key),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const header = base64url(utf8(JSON.stringify({ alg: 'ES256', kid: credentials.keyId })));
  const claims = base64url(
    utf8(JSON.stringify({ iss: credentials.teamId, iat: Math.floor(now / 1000) })),
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    utf8(`${header}.${claims}`),
  );

  return { jwt: `${header}.${claims}.${base64url(signature)}`, mintedAt: now };
}

/** Whether a cached token is still worth reusing. */
export function tokenIsFresh(token: ApnsToken | null, now: number): token is ApnsToken {
  return token !== null && now - token.mintedAt < TOKEN_LIFETIME_MS;
}

/** What goes in the `aps` dictionary. Deliberately the minimum: a title,
 * a body, and a thread so that several pushes about one channel collapse
 * into a stack on the lock screen rather than a column. */
export interface ApnsAlert {
  title: string;
  body: string;
  threadId: string;
  /** Rides along for the app to read when a push is tapped. */
  data: Record<string, unknown>;
}

export function alertPayload(alert: ApnsAlert): Record<string, unknown> {
  return {
    aps: {
      alert: { title: alert.title, body: alert.body },
      sound: 'default',
      'thread-id': alert.threadId,
      'relevance-score': 1,
    },
    ...alert.data,
  };
}

/**
 * Send one alert to one device.
 *
 * `apns-expiration` is the interesting header and it is set to the
 * moment the thing being announced stops being true. Everything this
 * project pushes is prospective — "the Night on now decides the Season"
 * — so a notification delivered after that Night has finished is not
 * late, it is wrong. A phone that was off is better served by silence
 * than by being told to hurry and watch something that already ended.
 */
export async function push(
  jwt: string | null,
  device: { token: string; environment: 'sandbox' | 'production'; topic: string },
  payload: Record<string, unknown>,
  expiresAt: number,
): Promise<ApnsOutcome> {
  if (!jwt) return { status: 'unconfigured' };

  const response = await fetch(`${HOSTS[device.environment]}/3/device/${device.token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': device.topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(expiresAt / 1000)),
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) return { status: 'sent' };

  // Apple answers failures with a JSON `reason`, which is the only thing
  // that distinguishes a dead token from a misconfigured one — and those
  // need opposite responses, so it is read rather than guessed at from
  // the status alone.
  const reason = await response
    .json<{ reason?: string }>()
    .then((body) => body.reason ?? 'unknown')
    .catch(() => 'unreadable');

  if (response.status === 410 || reason === 'Unregistered' || reason === 'BadDeviceToken') {
    return { status: 'unregistered' };
  }
  return { status: 'failed', code: response.status, reason };
}
