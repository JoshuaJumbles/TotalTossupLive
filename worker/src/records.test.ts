import { describe, expect, it } from 'vitest';
import type { ContainerScore, RecordLedger, SeasonStreak } from '@total-tossup-live/shared';
import {
  applySeason,
  emptyLedger,
  markFor,
  notableBreaks,
  recordHolder,
  recordWeight,
} from '@total-tossup-live/shared';

// Here rather than in shared/ for the same reason the other shared-module
// suites are: shared/ has no test runner of its own.

/** Fold a Season close into the ledger. `record` is the all-time tally
 * *after* the Season was credited, so its total is the Season number. */
function close(
  ledger: RecordLedger,
  record: ContainerScore,
  streak: SeasonStreak,
  at = 0,
): { ledger: RecordLedger; breaks: ReturnType<typeof applySeason>['breaks'] } {
  return applySeason(ledger, { seasonNumber: record.humans + record.demons, record, streak, at });
}

describe('weighing a record', () => {
  it('is the log of how long the beaten mark stood', () => {
    expect(recordWeight(400)).toBeCloseTo(8.64, 2);
    expect(recordWeight(5)).toBeCloseTo(2.32, 2);
  });

  it('scores a mark broken immediately at nothing, rather than at minus infinity', () => {
    expect(recordWeight(0)).toBe(0);
    expect(recordWeight(1)).toBe(0);
  });

  it('puts a long-standing record above every rated headline, and a fresh one below', () => {
    // The point of weighing a record by age rather than by a rate: the
    // same event is the biggest news of the week or not news at all,
    // depending only on what it beat.
    expect(recordWeight(400)).toBeGreaterThan(6.5);
    expect(recordWeight(5)).toBeLessThan(6.5);
  });
});

describe('the cold start', () => {
  it('is quiet, without needing to be special-cased', () => {
    // A ledger opened at Season 1,200 records everything it sees at first
    // and weighs all of it at a bit or two, because nothing has been
    // beaten yet. No bootstrap period, no suppression flag — the 1/n
    // model does it.
    let ledger = emptyLedger(1200, 0);
    const first = close(ledger, { humans: 601, demons: 600 }, { side: 'humans', length: 4 });
    ledger = first.ledger;

    expect(first.breaks.map((b) => b.id).sort()).toEqual(['lead', 'reign', 'season_run']);
    for (const broken of first.breaks) {
      expect(broken.previous).toBeNull();
      expect(broken.weight).toBeLessThan(2);
    }
  });

  it('says where its claims begin, because it cannot know what came before', () => {
    const ledger = emptyLedger(1200, 1700);
    expect(ledger.since).toEqual({ seasonNumber: 1200, at: 1700 });
  });
});

describe('breaking a record', () => {
  it('takes the longest run and dates it', () => {
    let ledger = emptyLedger(1000, 0);
    ledger = close(ledger, { humans: 501, demons: 500 }, { side: 'humans', length: 4 }).ledger;

    const later = close(ledger, { humans: 800, demons: 602 }, { side: 'humans', length: 9 }, 99);
    const broken = later.breaks.find((b) => b.id === 'season_run')!;
    expect(broken).toMatchObject({ side: 'humans', value: 9, previous: 4, stood: 401 });
    expect(broken.weight).toBeCloseTo(8.65, 2);
    expect(markFor(later.ledger, 'season_run', 'humans')).toEqual({
      value: 9,
      seasonNumber: 1402,
      at: 99,
    });
  });

  it('does not count equalling it', () => {
    let ledger = emptyLedger(1000, 0);
    ledger = close(ledger, { humans: 501, demons: 500 }, { side: 'humans', length: 4 }).ledger;
    const again = close(ledger, { humans: 504, demons: 500 }, { side: 'humans', length: 4 });
    expect(again.breaks.map((b) => b.id)).not.toContain('season_run');
  });

  it('keeps the two sides\' marks apart', () => {
    let ledger = emptyLedger(1000, 0);
    ledger = close(ledger, { humans: 501, demons: 500 }, { side: 'humans', length: 6 }).ledger;
    const theirs = close(ledger, { humans: 501, demons: 505 }, { side: 'demons', length: 4 });
    // Four is a record for the Demons and not for the Humans, and the
    // Humans' six is untouched.
    expect(theirs.breaks.map((b) => b.id)).toContain('season_run');
    expect(markFor(theirs.ledger, 'season_run', 'demons')!.value).toBe(4);
    expect(markFor(theirs.ledger, 'season_run', 'humans')!.value).toBe(6);
  });
});

describe('the lead record', () => {
  it('belongs to whoever is in front, by the size of the gap', () => {
    const { ledger, breaks } = close(
      emptyLedger(1000, 0),
      { humans: 520, demons: 490 },
      { side: 'humans', length: 1 },
    );
    expect(breaks.find((b) => b.id === 'lead')).toMatchObject({ side: 'humans', value: 30 });
    expect(markFor(ledger, 'lead', 'demons')).toBeNull();
  });

  it('is not set at all while the record is level', () => {
    // No leader, no lead, and no reign either — a level record is nobody's
    // record and must not be credited to the side that happens to be on a
    // run.
    const { breaks } = close(
      emptyLedger(1000, 0),
      { humans: 500, demons: 500 },
      { side: 'humans', length: 3 },
    );
    expect(breaks.map((b) => b.id)).toEqual(['season_run']);
  });
});

describe('the reign record', () => {
  it('counts consecutive Seasons in front and resets when the lead changes hands', () => {
    let ledger = emptyLedger(1000, 0);
    // Humans lead for three Seasons running.
    for (const record of [
      { humans: 502, demons: 499 },
      { humans: 503, demons: 499 },
      { humans: 504, demons: 499 },
    ]) {
      ledger = close(ledger, record, { side: 'humans', length: 1 }).ledger;
    }
    expect(markFor(ledger, 'reign', 'humans')!.value).toBe(3);

    // The Demons take the lead. Their reign starts at one, and the
    // Humans' three is kept.
    const flipped = close(ledger, { humans: 504, demons: 505 }, { side: 'demons', length: 6 });
    expect(markFor(flipped.ledger, 'reign', 'demons')!.value).toBe(1);
    expect(markFor(flipped.ledger, 'reign', 'humans')!.value).toBe(3);
  });

  it('is broken by going level, not just by falling behind', () => {
    let ledger = emptyLedger(1000, 0);
    ledger = close(ledger, { humans: 502, demons: 499 }, { side: 'humans', length: 1 }).ledger;
    ledger = close(ledger, { humans: 503, demons: 499 }, { side: 'humans', length: 2 }).ledger;
    // Level: nobody is in front, so the reign ends.
    ledger = close(ledger, { humans: 503, demons: 503 }, { side: 'demons', length: 1 }).ledger;
    expect(ledger.reign.side).toBeNull();
    // Back in front, and it counts from one again.
    const resumed = close(ledger, { humans: 504, demons: 503 }, { side: 'humans', length: 1 });
    expect(resumed.breaks.map((b) => b.id)).not.toContain('reign');
    expect(markFor(resumed.ledger, 'reign', 'humans')!.value).toBe(2);
  });
});

describe('reading the ledger', () => {
  it('names a holder only when one side is clear of the other', () => {
    let ledger = emptyLedger(1000, 0);
    ledger = close(ledger, { humans: 501, demons: 500 }, { side: 'humans', length: 5 }).ledger;
    expect(recordHolder(ledger, 'season_run')).toMatchObject({ side: 'humans' });

    // Both sides on five: a shared record is nobody's to display.
    ledger = close(ledger, { humans: 501, demons: 505 }, { side: 'demons', length: 5 }).ledger;
    expect(recordHolder(ledger, 'season_run')).toBeNull();
  });

  it('has no holder for a record nobody has set', () => {
    expect(recordHolder(emptyLedger(1, 0), 'reign')).toBeNull();
  });

  it('leaves the ledger it was given alone', () => {
    // applySeason is the coordinator's whole Season-close path, and it
    // runs against a ledger read from storage. Mutating that in place
    // would make a failed write silently half-applied.
    const before = emptyLedger(1000, 0);
    const snapshot = JSON.stringify(before);
    close(before, { humans: 520, demons: 490 }, { side: 'humans', length: 7 });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('what is worth writing down', () => {
  it('drops a counter beating itself a Season later', () => {
    // The reason this filter exists. While a side holds the lead their
    // reign is one longer every Season, and each of those technically
    // breaks the mark set one Season before. Zero bits by construction,
    // and 10.94 a day across 800,000 simulated Seasons if kept.
    let ledger = emptyLedger(1000, 0);
    const kept: string[] = [];
    for (const record of [
      { humans: 502, demons: 499 },
      { humans: 503, demons: 499 },
      { humans: 504, demons: 499 },
    ]) {
      const applied = close(ledger, record, { side: 'humans', length: 1 });
      ledger = applied.ledger;
      kept.push(...notableBreaks(applied.breaks).map((b) => b.id));
    }
    expect(kept).toEqual([]);
    // The marks still advanced — only the reporting was dropped.
    expect(markFor(ledger, 'reign', 'humans')!.value).toBe(3);
    expect(markFor(ledger, 'lead', 'humans')!.value).toBe(5);
  });

  it('keeps a mark that actually survived', () => {
    let ledger = emptyLedger(1000, 0);
    ledger = close(ledger, { humans: 501, demons: 500 }, { side: 'humans', length: 4 }).ledger;
    const later = close(ledger, { humans: 800, demons: 602 }, { side: 'humans', length: 9 });
    expect(notableBreaks(later.breaks).map((b) => b.id)).toContain('season_run');
  });

  it('is a floor on information, not on interest', () => {
    // Deliberately not the digest's 6.5 bits: a mark that stood a month
    // is still worth showing on a history screen even though it will
    // never lead a digest.
    const stoodAMonth = close(
      close(emptyLedger(1000, 0), { humans: 501, demons: 500 }, { side: 'humans', length: 4 })
        .ledger,
      { humans: 530, demons: 500 },
      { side: 'humans', length: 5 },
    );
    const run = notableBreaks(stoodAMonth.breaks).find((b) => b.id === 'season_run')!;
    expect(run.weight).toBeLessThan(6.5);
    expect(run.weight).toBeGreaterThan(0);
  });
});
