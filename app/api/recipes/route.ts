import { NextRequest, NextResponse } from "next/server";
import { generateRecipes, describeAiError } from "@/lib/ai";
import { buildRecipePrompt } from "@/lib/prompts";
import { RecipeResponseSchema } from "@/lib/schemas";
import { scoreRecipe } from "@/lib/waste-priority";
import type { DetectedIngredient, DietaryPreference, Recipe } from "@/types";

export async function POST(req: NextRequest) {
  let body: { ingredients: DetectedIngredient[]; preference?: DietaryPreference };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request, try again" }, { status: 400 });
  }
  const { ingredients, preference } = body;

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return NextResponse.json({ error: "No ingredients provided" }, { status: 400 });
  }

  const prompt = buildRecipePrompt(
    ingredients.map((i) => ({
      name: i.name,
      category: i.category,
      wastePriorityScore: i.wastePriorityScore,
    })),
    preference ?? "none",
  );

  let parsed;
  try {
    const raw = await generateRecipes(prompt);
    parsed = RecipeResponseSchema.parse(raw);
  } catch (err) {
    console.error("recipes route error:", err);
    const known = describeAiError(err);
    return NextResponse.json(
      {
        error: known?.message ?? "Could not generate recipes, try again",
        retryAfterSeconds: known?.retryAfterSeconds,
      },
      { status: known?.status ?? 502 },
    );
  }

  const scoreByName = new Map(ingredients.map((i) => [i.name, i.wastePriorityScore]));

  const recipes: Recipe[] = parsed.recipes
    .map((r) => ({
      ...r,
      id: crypto.randomUUID(),
      wastePriorityScore: scoreRecipe(r.usedIngredients.map((n) => scoreByName.get(n) ?? 0)),
    }))
    .sort(
      (a, b) =>
        b.wastePriorityScore - a.wastePriorityScore ||
        a.missingIngredients.length - b.missingIngredients.length,
    );

  return NextResponse.json({ recipes });
}
