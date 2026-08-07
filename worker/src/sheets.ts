import type { BestOfSheetConfig, Sheet } from '@total-tossup-live/shared';

// Both satisfy isValidContainerSize (N mod 4 ∈ {1, 2}) — see
// shared/src/scoring.ts for why that guarantees no tie is ever possible.
export const NIGHTS_PER_WEEK = 6;
export const WEEKS_PER_SEASON = 6;

export const DEBUG_SHEET_CONFIG: BestOfSheetConfig = {
  familyId: 'bestof',
  roundSize: 5,
  roundWinThreshold: 3,
  targetRoundPoints: 10,
};

/** The only Sheet that exists so far — every Night reuses it until a real
 * Family/Sheet library and per-Night rotation lands. */
export const DEBUG_SHEET: Sheet = {
  id: 'debug-bestof',
  familyId: 'bestof',
  name: 'Debug: Best of 5',
  config: DEBUG_SHEET_CONFIG,
};
