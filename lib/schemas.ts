import { z } from "zod";

export const DetectedIngredientSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["produce", "dairy", "protein", "pantry", "condiment", "other"]),
  estimatedQuantity: z.string().min(1),
  confidence: z.number().min(0).max(1),
  freshnessState: z.enum(["fresh", "aging", "use_soon", "spoiling"]),
});

export const AnalyzeResponseSchema = z.object({
  ingredients: z.array(DetectedIngredientSchema),
});

export const RecipeIngredientSchema = z.object({
  name: z.string().min(1),
  estimatedQuantity: z.string().min(1),
});

export const RecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  usedIngredients: z.array(z.string()),
  missingIngredients: z.array(RecipeIngredientSchema),
  prepTimeMinutes: z.number().positive(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  cuisineTag: z.string().min(1),
});

export const RecipeResponseSchema = z.object({
  recipes: z.array(RecipeSchema),
});
