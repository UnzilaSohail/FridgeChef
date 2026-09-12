"use client";

import { useState } from "react";
import { ChefHat, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { FridgeUploader } from "@/components/FridgeUploader";
import { IngredientChip } from "@/components/IngredientChip";
import { RecipeCard } from "@/components/RecipeCard";
import type { DetectedIngredient, DietaryPreference, Recipe } from "@/types";

type Step = "upload" | "confirm" | "results";

const PREFERENCES: { value: DietaryPreference; label: string }[] = [
  { value: "none", label: "No restrictions" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
];

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<DetectedIngredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [preference, setPreference] = useState<DietaryPreference>("none");

  async function handleImage(dataUrl: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Analysis failed");
      const { ingredients: found } = await res.json();
      setIngredients((prev) => [...prev, ...found]);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function removeIngredient(id: string) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ingredients, preference }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Recipe generation failed");
      const { recipes: suggested } = await res.json();
      setRecipes(suggested);
      setStep("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-5 py-12 sm:py-16">
        <header className="text-center space-y-3 mb-10">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-terracotta text-cream mb-1">
            <ChefHat size={22} strokeWidth={2} />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            FridgeChef
          </h1>
          <p className="text-charcoal-soft max-w-sm mx-auto">
            Photograph your fridge, get meals that rescue what&apos;s about to spoil.
          </p>
        </header>

        <Steps current={step} />

        {error && (
          <p className="mt-6 text-sm text-rust text-center bg-rust-soft border border-rust/20 rounded-xl py-2.5 px-4">
            {error}
          </p>
        )}

        <div className="mt-8">
          {step === "upload" && <FridgeUploader onImage={handleImage} disabled={loading} />}

          {step === "confirm" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-medium">
                  Found {ingredients.length} item{ingredients.length !== 1 && "s"}
                  <span className="text-charcoal-soft font-sans text-sm font-normal ml-2">
                    review before we suggest meals
                  </span>
                </h2>
                <FridgeUploader onImage={handleImage} disabled={loading} compact />
              </div>

              <div className="space-y-2">
                {ingredients.map((ing) => (
                  <IngredientChip key={ing.id} ingredient={ing} onRemove={removeIngredient} />
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {PREFERENCES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPreference(p.value)}
                    className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${
                      preference === p.value
                        ? "bg-charcoal text-cream border-charcoal"
                        : "border-border text-charcoal-soft hover:border-charcoal/40"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSuggest}
                disabled={loading || ingredients.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-terracotta text-cream px-6 py-3.5 font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Thinking…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Suggest meals
                  </>
                )}
              </button>
            </div>
          )}

          {step === "results" && (
            <div className="space-y-5">
              <button
                onClick={() => setStep("confirm")}
                className="inline-flex items-center gap-1.5 text-sm text-charcoal-soft hover:text-charcoal transition-colors"
              >
                <ArrowLeft size={15} /> Back to ingredients
              </button>
              <div className="space-y-4">
                {recipes.map((r) => (
                  <RecipeCard key={r.id} recipe={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Steps({ current }: { current: Step }) {
  const order: Step[] = ["upload", "confirm", "results"];
  const labels: Record<Step, string> = {
    upload: "Photograph",
    confirm: "Review",
    results: "Cook",
  };
  const idx = order.indexOf(current);

  return (
    <div className="flex items-center justify-center gap-2">
      {order.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                i <= idx ? "bg-terracotta text-cream" : "bg-cream-deep text-charcoal-soft"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`text-xs font-medium ${i <= idx ? "text-charcoal" : "text-charcoal-soft"}`}
            >
              {labels[s]}
            </span>
          </div>
          {i < order.length - 1 && <span className="w-6 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}
