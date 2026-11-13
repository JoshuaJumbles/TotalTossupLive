import { describe, expect, it } from 'vitest';
import type { Sheet } from '@total-tossup-live/shared';
import {
  channelDirectory,
  presetFor,
  sheetForNight,
  DEBUG_PRESET,
  PRODUCTION_PRESET,
  TEAMWORK_PRESET,
  type ChannelPreset,
} from './presets';

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
  it('is a full 7-Night tour of every Teamwork Sheet, Rooftop repeated for the 7th, before wrapping', () => {
    expect(TEAMWORK_PRESET.nightsPerWeek).toBe(7);
    expect(TEAMWORK_PRESET.sheets).toHaveLength(7);

    const styles = Array.from({ length: 7 }, (_, i) => sheetForNight(TEAMWORK_PRESET, i + 1).style);
    expect(new Set(styles)).toEqual(new Set(['barricade', 'cloudfight', 'inferno', 'rivershark', 'portal', 'rooftop']));
    // Every style but Rooftop appears exactly once; Rooftop (Nights 6 and
    // 7) appears twice -- the deliberate repeat-the-last-Sheet placeholder
    // best-of's own odd nightsPerWeek now needs (see TEAMWORK_PRESET's own
    // doc comment).
    expect(styles.filter((style) => style === 'rooftop')).toHaveLength(2);
    expect(sheetForNight(TEAMWORK_PRESET, 6).style).toBe('rooftop');
    expect(sheetForNight(TEAMWORK_PRESET, 7).style).toBe('rooftop');

    // Night 8 wraps back to Night 1's own Sheet, same modulo convention
    // every other rotation relies on.
    expect(sheetForNight(TEAMWORK_PRESET, 8).style).toBe(sheetForNight(TEAMWORK_PRESET, 1).style);
  });
});
describe('picking a channel\'s preset', () => {
  it('still maps the named channels to their own presets', () => {
    expect(presetFor('debug')).toBe(DEBUG_PRESET);
    expect(presetFor('main')).toBe(PRODUCTION_PRESET);
  });

  it('still lands an unknown id on the production preset', () => {
    // Load-bearing and easy to lose when an if-chain becomes a lookup:
    // minting a Durable Object is just addressing a name, so a typo in a
    // URL has always produced a working best-of-7 channel rather than an
    // error, and the /channels listing does not change that.
    expect(presetFor('not-a-channel')).toBe(PRODUCTION_PRESET);
    expect(presetFor('')).toBe(PRODUCTION_PRESET);
  });
});

describe('the channel directory', () => {
  it('offers every channel that has a preset of its own', () => {
    // The whole point of deriving it. If a Family is added with a preset
    // and this list does not grow, the channel works perfectly and is
    // invisible to every client -- which is the failure mode a
    // hand-written second list would eventually produce.
    const ids = channelDirectory().map((channel) => channel.id);
    expect(ids).toContain('main');
    expect(ids).toContain('teamwork');
    expect(ids).toContain('trifecta');
    expect(ids).toContain('rpf');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('agrees with presetFor for every channel it lists', () => {
    for (const channel of channelDirectory()) {
      const preset = presetFor(channel.id);
      expect(channel.nightsPerWeek, channel.id).toBe(preset.nightsPerWeek);
      expect(channel.weeksPerSeason, channel.id).toBe(preset.weeksPerSeason);
      expect(channel.autoStart, channel.id).toBe(preset.autoStart);
    }
  });

  it('names the Families and styles a renderer would have to know', () => {
    const main = channelDirectory().find((channel) => channel.id === 'main')!;
    expect(main.familyIds).toEqual(['bestof']);
    expect(main.styles).toEqual(['battle']);
    expect(main.autoStart).toBe(true);
  });

  it('says which channels are asleep, because a client has to offer to start them', () => {
    // Every channel but main is autoStart: false, so a picker that did
    // not know this would switch to one and show a dead screen.
    const asleep = channelDirectory().filter((channel) => !channel.autoStart);
    expect(asleep.length).toBeGreaterThan(0);
    expect(asleep.map((channel) => channel.id)).not.toContain('main');
  });

  it('lists no Family without an engine to run it', () => {
    // A channel whose Family has no registered engine throws inside
    // engineFor the moment it starts a Night, so offering it in a picker
    // would be offering a crash.
    const registered = new Set(['bestof', 'teamwork', 'trifecta', 'rpf']);
    for (const channel of channelDirectory()) {
      for (const familyId of channel.familyIds) {
        expect(registered.has(familyId), `${channel.id} -> ${familyId}`).toBe(true);
      }
    }
  });
});
