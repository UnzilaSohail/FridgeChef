import { Clock3, ChefHat, ShoppingBag } from "lucide-react";
import type { Recipe } from "@/types";
import { WastePriorityBadge } from "@/components/WastePriorityBadge";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const accent =
    recipe.wastePriorityScore >= 80 ? "bg-rust" : recipe.wastePriorityScore >= 55 ? "bg-amber" : "bg-olive";

  return (
    <div className="group relative rounded-2xl border border-border bg-card p-5 pl-6 space-y-4 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_-8px_rgba(42,36,32,0.18)]">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${accent} transition-all duration-300 group-hover:w-1.5`} />
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold leading-snug">{recipe.title}</h3>
        <WastePriorityBadge score={recipe.wastePriorityScore} />
      </div>
      <p className="text-sm text-charcoal-soft leading-relaxed">{recipe.description}</p>
      <div className="flex gap-4 text-xs text-charcoal-soft">
        <span className="inline-flex items-center gap-1">
          <Clock3 size={13} /> {recipe.prepTimeMinutes} min
        </span>
        <span className="inline-flex items-center gap-1 capitalize">
          <ChefHat size={13} /> {recipe.difficulty}
        </span>
        <span className="capitalize">{recipe.cuisineTag}</span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-olive mb-1.5">
          From your fridge
        </p>
        <div className="flex flex-wrap gap-1.5">
          {recipe.usedIngredients.map((name) => (
            <span
              key={name}
              className="text-xs bg-olive-soft text-olive px-2.5 py-1 rounded-full capitalize"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {recipe.missingIngredients.length > 0 && (
        <div className="pt-1 border-t border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-soft mt-3 mb-1.5 flex items-center gap-1.5">
            <ShoppingBag size={13} />
            You&apos;ll also need <span className="normal-case font-normal">(estimated)</span>
          </p>
          <ul className="text-sm text-charcoal-soft space-y-0.5">
            {recipe.missingIngredients.map((ing) => (
              <li key={ing.name}>
                {ing.name} <span className="text-charcoal-soft/60">— {ing.estimatedQuantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
