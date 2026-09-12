import { X } from "lucide-react";
import type { DetectedIngredient } from "@/types";
import { WastePriorityBadge } from "@/components/WastePriorityBadge";

export function IngredientChip({
  ingredient,
  onRemove,
}: {
  ingredient: DetectedIngredient;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all duration-200 hover:border-terracotta/40 hover:shadow-[0_4px_16px_-6px_rgba(42,36,32,0.15)] hover:-translate-y-px">
      <div className="flex-1 min-w-0">
        <p className="font-display font-medium capitalize truncate">{ingredient.name}</p>
        <p className="text-sm text-charcoal-soft">{ingredient.estimatedQuantity}</p>
      </div>
      <WastePriorityBadge score={ingredient.wastePriorityScore} />
      <button
        onClick={() => onRemove(ingredient.id)}
        aria-label={`Remove ${ingredient.name}`}
        className="shrink-0 text-charcoal-soft/50 hover:text-rust hover:scale-125 hover:rotate-90 transition-all duration-200"
      >
        <X size={18} />
      </button>
    </div>
  );
}
