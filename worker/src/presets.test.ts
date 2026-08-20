import { describe, expect, it } from 'vitest';
import type { Sheet } from '@total-tossup-live/shared';
import { sheetForNight, TEAMWORK_PRESET, type ChannelPreset } from './presets';

function sheetStub(id: string): Sheet {
  return { id, familyId: 'bestof', name: id, style: 'simple', config: { familyId: 'bestof' } };
}

describe('sheetForNight', () => {
  it('reuses the only Sheet for every Night when just one is defined', () => {
    const preset: ChannelPreset = {
      nightsPerWeek: 6,
      weeksPerSeason: 6,
      sheets: [sheetStub('only')],
      phaseDurationsMs: {} as ChannelPreset['phaseDurationsMs'],
      autoStart: true,
    };

    for (let night = 1; night <= 6; night++) {
      expect(sheetForNight(preset, night).id).toBe('only');
    }
  });

  it('rotates through multiple Sheets by Night number, 1-indexed', () => {
    const preset: ChannelPreset = {
      nightsPerWeek: 6,
      weeksPerSeason: 6,
      sheets: [sheetStub('night-1'), sheetStub('night-2'), sheetStub('night-3')],
      phaseDurationsMs: {} as ChannelPreset['phaseDurationsMs'],
      autoStart: true,
    };

    expect(sheetForNight(preset, 1).id).toBe('night-1');
    expect(sheetForNight(preset, 2).id).toBe('night-2');
    expect(sheetForNight(preset, 3).id).toBe('night-3');
  });

  it('wraps around via modulo once Night number exceeds the rotation length', () => {
    const preset: ChannelPreset = {
      nightsPerWeek: 6,
      weeksPerSeason: 6,
      sheets: [sheetStub('a'), sheetStub('b')],
      phaseDurationsMs: {} as ChannelPreset['phaseDurationsMs'],
      autoStart: true,
    };

    expect(sheetForNight(preset, 3).id).toBe('a'); // (3-1) % 2 = 0
    expect(sheetForNight(preset, 4).id).toBe('b'); // (4-1) % 2 = 1
  });
});

describe('TEAMWORK_PRESET', () => {
  it('is a full 6-Night tour of every Teamwork Sheet, each exactly once, before wrapping', () => {
    expect(TEAMWORK_PRESET.nightsPerWeek).toBe(6);
    expect(TEAMWORK_PRESET.sheets).toHaveLength(6);

    const styles = Array.from({ length: 6 }, (_, i) => sheetForNight(TEAMWORK_PRESET, i + 1).style);
    expect(new Set(styles)).toEqual(new Set(['barricade', 'cloudfight', 'inferno', 'rivershark', 'portal', 'rooftop']));
    expect(new Set(styles).size).toBe(6); // no duplicates

    // Night 7 wraps back to Night 1's own Sheet, same modulo convention
    // every other rotation relies on.
    expect(sheetForNight(TEAMWORK_PRESET, 7).style).toBe(sheetForNight(TEAMWORK_PRESET, 1).style);
  });
});
