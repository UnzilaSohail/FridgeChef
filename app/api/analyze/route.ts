import { NextRequest, NextResponse } from "next/server";
import { analyzeImage, describeAiError } from "@/lib/ai";
import { AnalyzeResponseSchema } from "@/lib/schemas";
import { scoreIngredient } from "@/lib/waste-priority";
import type { DetectedIngredient } from "@/types";

// ponytail: no rate limiting yet — fine for local dev, add IP-based
// limiting (e.g. @upstash/ratelimit) before this route is public.
export async function POST(req: NextRequest) {
  let imageDataUrl: unknown;
  try {
    ({ imageDataUrl } = await req.json());
  } catch {
    return NextResponse.json(
      { error: "Photo is too large or the upload was interrupted, try again" },
      { status: 413 },
    );
  }
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
  }

  let parsed;
  try {
    const raw = await analyzeImage(imageDataUrl);
    parsed = AnalyzeResponseSchema.parse(raw);
  } catch (err) {
    console.error("analyze route error:", err);
    const known = describeAiError(err);
    return NextResponse.json(
      { error: known?.message ?? "Could not read that photo, please try again" },
      { status: known?.status ?? 502 },
    );
  }

  const ingredients: DetectedIngredient[] = parsed.ingredients.map((ing) => ({
    ...ing,
    id: crypto.randomUUID(),
    wastePriorityScore: scoreIngredient(ing.freshnessState, ing.category),
  }));

  return NextResponse.json({ ingredients });
}
