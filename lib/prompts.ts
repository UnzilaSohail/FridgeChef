import type { DietaryPreference } from "@/types";

export const ANALYZE_PROMPT = `You are looking at a photo of the inside of a refrigerator, freezer, or pantry.
List only items you can clearly identify. Do not guess at items you cannot see, and do not list brand names.
List at most 20 items total — if more are visible, include only the 20 most clearly identifiable ones.

For each item, provide:
- name: lowercase, singular, generic (e.g. "bell pepper" not "red pepper, organic")
- category: one of produce, dairy, protein, pantry, condiment, other
- estimatedQuantity: a short human phrase, e.g. "1 bunch", "2-3 pieces", "half gallon"
- confidence: 0 to 1
- freshnessState: one of fresh, aging, use_soon, spoiling — based on visible cues like browning, wilting, or mold

Return ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{"ingredients":[{"name":"spinach","category":"produce","estimatedQuantity":"1 bag","confidence":0.9,"freshnessState":"use_soon"}]}`;

export function buildRecipePrompt(
  ingredients: { name: string; category: string; wastePriorityScore: number }[],
  preference: DietaryPreference,
): string {
  return `Given these ingredients currently in the user's fridge (with a waste-priority score per item, 0-100, higher = more urgent to use soon), suggest 4-6 realistic home-cook recipes.

Ingredients: ${JSON.stringify(ingredients)}
Dietary preference: ${preference}

Rules:
- Prefer recipes that use higher waste-priority ingredients.
- For each recipe, split ingredients into usedIngredients (names that match the provided list) and missingIngredients (things the recipe needs that were NOT in the list, with an estimated quantity).
- Keep recipes realistic and simple, no obscure techniques or ingredients.
- Respect the dietary preference strictly.

Return ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{"recipes":[{"title":"...","description":"...","usedIngredients":["spinach"],"missingIngredients":[{"name":"feta","estimatedQuantity":"1/2 cup"}],"prepTimeMinutes":20,"difficulty":"easy","cuisineTag":"mediterranean"}]}`;
}

export const JSON_RETRY_SUFFIX =
  "\n\nYour previous response was not valid JSON. Return ONLY the JSON object, no markdown fences, no commentary.";
