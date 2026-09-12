import { Flame, Clock3, Leaf } from "lucide-react";

export function WastePriorityBadge({ score }: { score: number }) {
  const tier =
    score >= 80
      ? { label: "Use today", Icon: Flame, cls: "bg-rust-soft text-rust", urgent: true }
      : score >= 55
        ? { label: "Use soon", Icon: Clock3, cls: "bg-amber-soft text-amber", urgent: false }
        : { label: "Fresh", Icon: Leaf, cls: "bg-olive-soft text-olive", urgent: false };

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-transform ${tier.cls} ${
        tier.urgent ? "animate-pulse" : ""
      }`}
    >
      <tier.Icon size={12} strokeWidth={2.5} />
      {tier.label}
    </span>
  );
}
