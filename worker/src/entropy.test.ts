import { afterEach, describe, expect, it } from 'vitest';
import {
  randomBelow,
  useDefaultEntropySource,
  useEntropySource,
  type Refill,
} from './entropy';

afterEach(() => {
  useDefaultEntropySource();
});

/** A source that hands out a fixed sequence of bytes, repeating. Lets the
 * tests below say exactly which bytes the pool is spending. */
function bytes(sequence: number[]): Refill {
  let next = 0;
  return (into) => {
    for (let i = 0; i < into.length; i += 1) {
      into[i] = sequence[next % sequence.length];
      next += 1;
    }
  };
}

/** Every byte value exactly once, in order. 256 draws of randomBelow(n)
 * against this is the whole distribution, not a sample of it. */
function everyByteOnce(): Refill {
  return (into) => {
    for (let i = 0; i < into.length; i += 1) into[i] = i % 256;
  };
}

describe('drawing below a bound', () => {
  it('is uniform over a bound that does not divide 256', () => {
    // The modulo-bias test, and the reason randomBelow is not one line.
    // Three does not divide 256, so `byte % 3` over every byte gives
    // 86/85/85 — one value 1.2% commoner than the others. Rejecting the
    // single ragged byte above the last whole multiple gives 85 each.
    useEntropySource(everyByteOnce());

    const counts = [0, 0, 0];
    // 255 of the 256 bytes are accepted, so 255 draws spend the pool
    // exactly, and anything biased shows up as an uneven split.
    for (let i = 0; i < 255; i += 1) counts[randomBelow(3)] += 1;

    expect(counts).toEqual([85, 85, 85]);
  });

  it('rejects the ragged tail rather than folding it back in', () => {
    // 255 is the byte that cannot be used for a bound of 3. Fed nothing
    // but 255s the draw must not return — it must keep drawing — so the
    // only way this terminates is if the pool refills and eventually
    // offers something usable.
    let refills = 0;
    useEntropySource((into) => {
      refills += 1;
      into.fill(refills === 1 ? 255 : 9);
    });

    expect(randomBelow(3)).toBe(0);
    expect(refills).toBe(2);
  });

  it('is uniform over a bound that does divide 256', () => {
    useEntropySource(everyByteOnce());
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 256; i += 1) counts[randomBelow(4)] += 1;
    expect(counts).toEqual([64, 64, 64, 64]);
  });

  it('draws more than one byte for a bound that will not fit in one', () => {
    // 1000 needs two bytes. Spending only one would cap the result at 255
    // and silently break any future caller with a large bound.
    useEntropySource(bytes([3, 232]));
    expect(randomBelow(1000)).toBe(3 * 256 + 232 - 1000);
  });

  it('needs no randomness at all for a bound of one', () => {
    let asked = false;
    useEntropySource((into) => {
      asked = true;
      into.fill(0);
    });
    expect(randomBelow(1)).toBe(0);
    expect(randomBelow(0)).toBe(0);
    expect(asked).toBe(false);
  });
});

describe('the pool', () => {
  it('refills instead of running off the end of itself', () => {
    // The pool is 256 bytes and a flip costs one, so a day of channel
    // traffic is hundreds of refills. Running past the end would read
    // undefined and quietly return NaN.
    let refills = 0;
    useEntropySource((into) => {
      refills += 1;
      into.fill(1);
    });

    for (let i = 0; i < 600; i += 1) expect(randomBelow(2)).toBe(1);
    expect(refills).toBe(3);
  });

  it('throws nothing away mid-pool when the source is swapped', () => {
    // Swapping sources discards the remainder on purpose: a pool holding
    // Math.random bytes must not keep being spent after someone points
    // the channel at a real source.
    useEntropySource(bytes([0]));
    expect(randomBelow(2)).toBe(0);
    useEntropySource(bytes([1]));
    expect(randomBelow(2)).toBe(1);
  });
});

describe('the platform source', () => {
  it('produces both faces of a coin, and not at a tilt', () => {
    // Not a test of crypto.getRandomValues — it is a test that this
    // module is wired to it and that nothing downstream is stuck. A fair
    // coin over 10,000 draws lands within a couple of hundred of even;
    // anything outside 4,500-5,500 is broken rather than unlucky.
    useDefaultEntropySource();
    let heads = 0;
    for (let i = 0; i < 10_000; i += 1) heads += randomBelow(2);
    expect(heads).toBeGreaterThan(4_500);
    expect(heads).toBeLessThan(5_500);
  });
});
