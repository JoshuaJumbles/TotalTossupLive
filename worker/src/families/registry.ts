import { bestOfEngine } from './bestof';
import { teamworkEngine } from './teamwork';
import type { FamilyEngine } from './types';

/**
 * The actual seam a new Family plugs into — a plain lookup by familyId,
 * used by every place channelDurableObject.ts needs to run a Night's
 * engine (beginNight/resolveFlip/beginNextStep). Loosely typed (`any` on
 * the generic params) on purpose: the whole point of this map is holding
 * engines with *different* TState/TConfig side by side, which TypeScript
 * can't express without either a discriminated-map type per familyId or
 * losing the ability to store them together at all — the coordinator
 * already treats nightState/sheetConfig loosely elsewhere (casts to the
 * specific Family's shape where it needs to), so this matches that
 * existing trade-off rather than introducing a new one.
 */
const FAMILY_ENGINES: Record<string, FamilyEngine<any, any>> = {
  bestof: bestOfEngine,
  teamwork: teamworkEngine,
};

export function engineFor(familyId: string): FamilyEngine<any, any> {
  const engine = FAMILY_ENGINES[familyId];
  if (!engine) throw new Error(`no FamilyEngine registered for familyId "${familyId}"`);
  return engine;
}
