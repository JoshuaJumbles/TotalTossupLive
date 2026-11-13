import { describe, expect, it } from 'vitest';
import { alertPayload, mintToken, readCredentials, tokenIsFresh } from './apns';
import { readRegistration, withDevice, withoutDevice } from './devices';

/** A throwaway P-256 key in the PEM shape Apple hands out, so the token
 * tests run against real ECDSA rather than a stub. */
async function p8(): Promise<{ pem: string; publicKey: CryptoKey }> {
  // Both assertions are the Workers types being imprecise rather than
  // this being unsound: generateKey is declared as returning a key *or* a
  // pair, and only the algorithm name decides which, which the type
  // system has no way to follow.
  const usages: string[] = ['sign', 'verify'];
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    usages,
  )) as CryptoKeyPair;
  // exportKey is declared as returning raw bytes *or* a JWK, decided by
  // the format argument the types cannot follow. 'pkcs8' is always bytes.
  const pkcs8 = new Uint8Array(
    (await crypto.subtle.exportKey('pkcs8', pair.privateKey)) as ArrayBuffer,
  );
  let binary = '';
  for (const byte of pkcs8) binary += String.fromCharCode(byte);
  const body = btoa(binary).replace(/(.{64})/g, '$1\n');
  return {
    pem: `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`,
    publicKey: pair.publicKey,
  };
}

function decodeSegment(segment: string): Record<string, unknown> {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)));
}

describe('the provider token', () => {
  it('is a JWT Apple can actually verify', async () => {
    // The one part of this that cannot be reasoned about and has to be
    // run. WebCrypto's ECDSA signature is already the raw r‖s pair JWS
    // ES256 wants, unlike Node's DER — get that wrong and Apple answers
    // with a malformed-token error and no further hint, so the signature
    // is verified here rather than merely produced.
    const { pem, publicKey } = await p8();
    const token = await mintToken({ key: pem, keyId: 'ABC1234567', teamId: 'TEAM123456' }, 1_700_000_000_000);

    const [header, claims, signature] = token.jwt.split('.');
    expect(decodeSegment(header)).toEqual({ alg: 'ES256', kid: 'ABC1234567' });
    expect(decodeSegment(claims)).toEqual({ iss: 'TEAM123456', iat: 1_700_000_000 });

    const raw = signature.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(
      atob(raw + '='.repeat((4 - (raw.length % 4)) % 4)),
      (c) => c.charCodeAt(0),
    );
    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      bytes,
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(verified).toBe(true);
    // 64 bytes: r and s, no DER wrapper.
    expect(bytes.length).toBe(64);
  });

  it('is reused well inside the hour and refreshed well outside twenty minutes', () => {
    // Both ends matter and for opposite reasons: Apple rejects a token
    // older than an hour, and rejects a provider that re-mints one more
    // often than every twenty minutes.
    const token = { jwt: 'x', mintedAt: 0 };
    expect(tokenIsFresh(token, 20 * 60 * 1000)).toBe(true);
    expect(tokenIsFresh(token, 44 * 60 * 1000)).toBe(true);
    expect(tokenIsFresh(token, 46 * 60 * 1000)).toBe(false);
    expect(tokenIsFresh(null, 0)).toBe(false);
  });
});

describe('reading credentials', () => {
  it('treats all three missing as unconfigured rather than broken', () => {
    expect(readCredentials({})).toBeNull();
    expect(readCredentials({ APNS_KEY: 'k', APNS_KEY_ID: 'i' })).toBeNull();
  });

  it('repairs a key pasted as one line', () => {
    // `wrangler secret put` given a file keeps the newlines; a key
    // pasted into a prompt often arrives with literal backslash-n, and
    // the failure is otherwise an unreadable DOMException from deep
    // inside importKey.
    const read = readCredentials({
      APNS_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
      APNS_KEY_ID: 'i',
      APNS_TEAM_ID: 't',
    });
    expect(read?.key).toBe('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----');
  });
});

describe('the alert payload', () => {
  it('is the aps dictionary plus whatever the app should read on a tap', () => {
    const payload = alertPayload({
      title: 'Winner takes the Season',
      body: 'The Night on now decides the whole thing.',
      threadId: 'channel:main',
      data: { channelId: 'main', momentId: 'title_night' },
    });
    expect(payload).toMatchObject({
      aps: {
        alert: { title: 'Winner takes the Season' },
        'thread-id': 'channel:main',
      },
      channelId: 'main',
      momentId: 'title_night',
    });
  });
});

describe('registering a device', () => {
  const token = 'a'.repeat(64);
  const body = { token, environment: 'sandbox', topic: 'live.totaltossup.TotalTossup' };

  it('takes what the app sends', () => {
    expect(readRegistration(body, 99)).toEqual({ ...body, registeredAt: 99 });
  });

  it('normalises the token, since Apple hands it over in either case', () => {
    expect(readRegistration({ ...body, token: token.toUpperCase() }, 0)?.token).toBe(token);
  });

  it('refuses anything it would otherwise interpolate into a request', () => {
    // The token goes into a URL path and the topic into a header, and a
    // client is the one party here that is not this project's own code.
    const cases: Record<string, unknown> = {
      'not an object': 'hello',
      'no token': { ...body, token: undefined },
      'a token that is not hex': { ...body, token: 'z'.repeat(64) },
      'a token with a path in it': { ...body, token: `${token}/../../3/device/x` },
      'a topic with a newline in it': { ...body, topic: 'live.x\r\nx-evil: 1' },
      'a topic that is not a bundle id': { ...body, topic: 'nodots' },
      'an environment Apple does not have': { ...body, environment: 'staging' },
      'no environment': { ...body, environment: undefined },
    };
    for (const [why, value] of Object.entries(cases)) {
      expect(readRegistration(value, 0), why).toBeNull();
    }
  });
});

describe('the device list', () => {
  const a = { token: 'a'.repeat(64), environment: 'sandbox' as const, topic: 't.t', registeredAt: 0 };

  it('replaces rather than duplicates on re-registration', () => {
    // The app registers on every launch, and the thing most likely to
    // have changed is the environment: a build sideloaded from Xcode
    // yesterday and installed from TestFlight today keeps its token and
    // changes which of Apple's two hosts will accept it.
    const list = withDevice(withDevice([], a), { ...a, environment: 'production' });
    expect(list).toHaveLength(1);
    expect(list[0].environment).toBe('production');
  });

  it('keeps other devices when one is retired', () => {
    const b = { ...a, token: 'b'.repeat(64) };
    expect(withoutDevice(withDevice(withDevice([], a), b), a.token)).toEqual([b]);
  });

  it('retires a token whatever case it is given in', () => {
    expect(withoutDevice([a], a.token.toUpperCase())).toEqual([]);
  });
});
