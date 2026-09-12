import type { FreshnessState } from "@/types";

// Typical days-to-spoil by category. Used as a prior to sanity-check the
// vision model's freshness read, since lighting/angle make vision-only
// freshness noisy.
const SHELF_LIFE_DAYS: Record<string, number> = {
  produce: 5,
  dairy: 10,
  protein: 4,
  pantry: 365,
  condiment: 180,
  other: 14,
};

const FRESHNESS_WEIGHT: Record<FreshnessState, number> = {
  spoiling: 100,
  use_soon: 70,
  aging: 40,
  fresh: 10,
};

export function scoreIngredient(freshness: FreshnessState, category: string): number {
  const visionScore = FRESHNESS_WEIGHT[freshness];
  const shelfLifeDays = SHELF_LIFE_DAYS[category] ?? SHELF_LIFE_DAYS.other;
  const priorScore = Math.max(0, 100 - shelfLifeDays * 3);
  return Math.round(visionScore * 0.7 + priorScore * 0.3);
}

export function scoreRecipe(usedIngredientScores: number[]): number {
  if (usedIngredientScores.length === 0) return 0;
  // Max, not average: a recipe that rescues one near-spoiling item should
  // outrank one that only uses pantry-stable items.
  return Math.max(...usedIngredientScores);
}
