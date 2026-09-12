export type FreshnessState = "fresh" | "aging" | "use_soon" | "spoiling";

export interface DetectedIngredient {
  id: string;
  name: string;
  category: string;
  estimatedQuantity: string;
  confidence: number;
  freshnessState: FreshnessState;
  wastePriorityScore: number;
}

export interface RecipeIngredient {
  name: string;
  estimatedQuantity: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  usedIngredients: string[];
  missingIngredients: RecipeIngredient[];
  prepTimeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  cuisineTag: string;
  wastePriorityScore: number;
}

export type DietaryPreference = "none" | "vegetarian" | "vegan";
