"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, ArrowLeft, Loader2, Sparkles, Check } from "lucide-react";
import { FridgeUploader } from "@/components/FridgeUploader";
import { IngredientChip } from "@/components/IngredientChip";
import { RecipeCard } from "@/components/RecipeCard";
import { fileToUploadableDataUrl } from "@/lib/image";
import type { DetectedIngredient, DietaryPreference, Recipe } from "@/types";

type Step = "upload" | "confirm" | "results";

const PREFERENCES: { value: DietaryPreference; label: string }[] = [
  { value: "none", label: "No restrictions" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
];

const SCAN_MESSAGES = ["Scanning shelves…", "Spotting ingredients…", "Checking freshness…"];
const COOK_MESSAGES = ["Weighing what's about to spoil…", "Matching flavors…", "Plating ideas…"];

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<DetectedIngredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [preference, setPreference] = useState<DietaryPreference>("none");

  useCyclingLabel(loading ? (step === "upload" ? SCAN_MESSAGES : COOK_MESSAGES) : null, setLoadingLabel);

  async function handleImage(file: File) {
    setLoading(true);
    setError(null);
    try {
      // Downscaling/decoding happens here, inside the same try/catch as the
      // network call, so a bad file (wrong type, corrupt, too large,
      // unsupported format) surfaces the same way an API failure does
      // instead of failing silently.
      const dataUrl = await fileToUploadableDataUrl(file);
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
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-3 mb-10"
        >
          <div className="relative inline-flex h-11 w-11 items-center justify-center mb-1">
            <span className="glow-pulse absolute inset-0 rounded-full bg-terracotta" />
            <div className="float-y relative flex h-11 w-11 items-center justify-center rounded-full bg-terracotta text-cream shadow-lg shadow-terracotta/30">
              <ChefHat size={22} strokeWidth={2} />
            </div>
          </div>
          <h1 className="shimmer-text font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            FridgeChef
          </h1>
          <p className="text-charcoal-soft max-w-sm mx-auto">
            Photograph your fridge, get meals that rescue what&apos;s about to spoil.
          </p>
        </motion.header>

        <Steps current={step} />

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 text-sm text-rust text-center bg-rust-soft border border-rust/20 rounded-xl py-2.5 px-4 overflow-hidden"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <FridgeUploader onFile={handleImage} disabled={loading} loadingLabel={loading ? loadingLabel : undefined} />
              </motion.div>
            )}

            {step === "confirm" && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-medium">
                    Found {ingredients.length} item{ingredients.length !== 1 && "s"}
                    <span className="text-charcoal-soft font-sans text-sm font-normal ml-2">
                      review before we suggest meals
                    </span>
                  </h2>
                  <FridgeUploader onFile={handleImage} disabled={loading} compact />
                </div>

                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {ingredients.map((ing, i) => (
                      <motion.div
                        key={ing.id}
                        layout
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 40, scale: 0.96 }}
                        transition={{ duration: 0.25, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <IngredientChip ingredient={ing} onRemove={removeIngredient} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="flex flex-wrap gap-2">
                  {PREFERENCES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPreference(p.value)}
                      className={`text-sm px-3.5 py-1.5 rounded-full border transition-all duration-200 active:scale-95 ${
                        preference === p.value
                          ? "bg-charcoal text-cream border-charcoal shadow-md scale-[1.03]"
                          : "border-border text-charcoal-soft hover:border-charcoal/40 hover:scale-[1.02]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <motion.button
                  onClick={handleSuggest}
                  disabled={loading || ingredients.length === 0}
                  whileHover={{ scale: loading ? 1 : 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-terracotta to-rust text-cream px-6 py-3.5 font-medium shadow-lg shadow-terracotta/25 hover:shadow-xl hover:shadow-terracotta/30 transition-shadow disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={loadingLabel}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                        >
                          {loadingLabel}
                        </motion.span>
                      </AnimatePresence>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} /> Suggest meals
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}

            {step === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <button
                  onClick={() => setStep("confirm")}
                  className="inline-flex items-center gap-1.5 text-sm text-charcoal-soft hover:text-charcoal transition-colors"
                >
                  <ArrowLeft size={15} /> Back to ingredients
                </button>
                <div className="space-y-4">
                  {recipes.map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 24, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <RecipeCard recipe={r} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

function useCyclingLabel(messages: string[] | null, setLabel: (v: string) => void) {
  useEffect(() => {
    if (!messages) return;
    let i = 0;
    setLabel(messages[0]);
    const id = setInterval(() => {
      i = (i + 1) % messages.length;
      setLabel(messages[i]);
    }, 1400);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);
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
              className={`relative flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium transition-colors duration-300 ${
                i <= idx ? "bg-terracotta text-cream" : "bg-cream-deep text-charcoal-soft"
              }`}
            >
              {i < idx ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={`text-xs font-medium transition-colors duration-300 ${i <= idx ? "text-charcoal" : "text-charcoal-soft"}`}
            >
              {labels[s]}
            </span>
          </div>
          {i < order.length - 1 && (
            <span className="relative w-6 h-px bg-border overflow-hidden rounded-full">
              <motion.span
                className="absolute inset-y-0 left-0 bg-terracotta"
                initial={false}
                animate={{ width: i < idx ? "100%" : "0%" }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
