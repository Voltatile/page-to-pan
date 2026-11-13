/**
 * The chef rank: a title earned from the best stars on every recipe added
 * together, so each recipe and each extra star moves the player up.
 */
export interface ChefRank {
  title: string;
  /** Total best stars needed for this rank. */
  minStars: number;
}

/** From the first visit to three stars on every recipe (three recipes). */
export const CHEF_RANKS: readonly ChefRank[] = [
  { title: 'Kitchen Newcomer', minStars: 0 },
  { title: 'Home Cook', minStars: 2 },
  { title: 'Line Cook', minStars: 4 },
  { title: 'Sous Chef', minStars: 6 },
  { title: 'Head Chef', minStars: 9 },
];

/** The rank a player holds with this many best stars in total. */
export function rankFor(totalStars: number): ChefRank {
  let rank = CHEF_RANKS[0] as ChefRank;
  for (const candidate of CHEF_RANKS) {
    if (totalStars >= candidate.minStars) {
      rank = candidate;
    }
  }
  return rank;
}

/** The next rank and how many more stars it takes, or null at the top. */
export function nextRank(
  totalStars: number,
): { rank: ChefRank; starsNeeded: number } | null {
  const rank = CHEF_RANKS.find((candidate) => candidate.minStars > totalStars);
  return rank == null
    ? null
    : { rank, starsNeeded: rank.minStars - totalStars };
}

/** The new rank's title when going from `before` to `after` stars ranks up. */
export function rankUpTitle(before: number, after: number): string | null {
  const reached = rankFor(after);
  return reached !== rankFor(before) ? reached.title : null;
}

/** One short sentence on what the next rank takes, for the title card. */
export function nextRankLine(totalStars: number): string {
  const next = nextRank(totalStars);
  if (next == null) {
    return `You are a ${rankFor(totalStars).title}!`;
  }
  const stars = next.starsNeeded === 1 ? 'star' : 'stars';
  return `${next.starsNeeded} more ${stars} to ${next.rank.title}.`;
}
