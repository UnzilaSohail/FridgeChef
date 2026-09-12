import OpenAI from "openai";
import { ANALYZE_PROMPT, JSON_RETRY_SUFFIX } from "@/lib/prompts";

// Groq's API is OpenAI-compatible, so the OpenAI SDK works unmodified
// pointed at Groq's base URL.
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ponytail: vision swap point. Anthropic key currently has no credit
// balance (see .env.local), so vision runs on Groq's Qwen 3.8 for now.
// Once credits are added, swap this model call for an Anthropic
// messages.create() call with claude-sonnet-5 — same JSON contract,
// same ANALYZE_PROMPT, no other code needs to change.
const VISION_MODEL = "qwen/qwen3.8-27b";
const TEXT_MODEL = "openai/gpt-oss-120b";

async function callJsonModel(
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxTokens: number,
): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await groq.chat.completions.create({
      model,
      messages,
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      // Both models are reasoning-capable and burn completion tokens on a
      // hidden "reasoning" pass before the actual JSON — at default effort
      // that ate the whole max_tokens budget and truncated the JSON mid-object.
      reasoning_effort: "low",
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
    const raw = completion.choices[0]?.message?.content ?? "";
    try {
      return JSON.parse(raw);
    } catch {
      messages = [...messages, { role: "user", content: JSON_RETRY_SUFFIX }];
    }
  }
  throw new Error("Model did not return valid JSON after retry");
}

export async function analyzeImage(imageDataUrl: string): Promise<unknown> {
  // 500: stays under Groq's free-tier ~1000 output-tokens/minute cap for
  // this model while covering a realistic ingredient list.
  return callJsonModel(
    VISION_MODEL,
    [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageDataUrl } },
          { type: "text", text: ANALYZE_PROMPT },
        ],
      },
    ],
    500,
  );
}

export async function generateRecipes(prompt: string): Promise<unknown> {
  return callJsonModel(TEXT_MODEL, [{ role: "user", content: prompt }], 1200);
}
