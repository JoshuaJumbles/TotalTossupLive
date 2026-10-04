import type { RpfCharacter, Side } from '@total-tossup-live/shared';

/**
 * The cast, from Joshua's Processing renderer (CharacterManager.pde's
 * loadCharacters). Each side fields exactly one Rock, one Paper, one
 * Scissors and one Royalty -- that's the Family's invariant, not a
 * property of this particular roster, and presets.ts asserts it.
 *
 * `art` is a key into the Sheet's own art bundle rather than a path: the
 * drawing is art and the type is rules, so they stay apart the same way
 * every other Family's icons do.
 */
const ARCHER: RpfCharacter = { name: 'Archer', type: 'scissors', art: 'centaur' };
const BULL: RpfCharacter = { name: 'Bull', type: 'rock', art: 'minotaur' };
const WIZARD: RpfCharacter = { name: 'Wizard', type: 'paper', art: 'wizard' };
const SHIELD_PRINCESS: RpfCharacter = { name: 'Princess', type: 'royalty', art: 'shieldPrincess' };

const SPIDER: RpfCharacter = { name: 'Spider', type: 'scissors', art: 'spider' };
const OGRE: RpfCharacter = { name: 'Ogre', type: 'rock', art: 'ogre' };
const CREATURE: RpfCharacter = { name: 'Creature', type: 'paper', art: 'voidBeast' };
const FLAME_PRINCESS: RpfCharacter = { name: 'Princess', type: 'royalty', art: 'flamePrincess' };

/** The human court and the demon court, each listed bottom of the arc
 * first. Joshua rotates these between Sheets -- his renderer generated
 * the numbered configExport layouts by stepping the order one place at a
 * time -- so a Sheet picks an offset rather than restating the cast. */
const HUMAN_COURT: RpfCharacter[] = [BULL, WIZARD, SHIELD_PRINCESS, ARCHER];
const DEMON_COURT: RpfCharacter[] = [SPIDER, FLAME_PRINCESS, CREATURE, OGRE];

/** Rotates a court by `offset` places, which is exactly what
 * CharacterManager.shuffle() does one step at a time. Keeping it as an
 * offset rather than four hand-written orders means a new Sheet is one
 * number, and the one-of-each invariant can't be broken by a typo. */
function rotate(court: RpfCharacter[], offset: number): RpfCharacter[] {
  const at = ((offset % court.length) + court.length) % court.length;
  return [...court.slice(at), ...court.slice(0, at)];
}

export function rpfLineup(humanOffset: number, demonOffset: number): Record<Side, RpfCharacter[]> {
  return {
    humans: rotate(HUMAN_COURT, humanOffset),
    demons: rotate(DEMON_COURT, demonOffset),
  };
}
