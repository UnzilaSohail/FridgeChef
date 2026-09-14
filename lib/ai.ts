import OpenAI, { AuthenticationError, RateLimitError, APIError } from "openai";
import { ANALYZE_PROMPT, JSON_RETRY_SUFFIX } from "@/lib/prompts";

export class MissingApiKeyError extends Error {
  constructor() {
    super("GROQ_API_KEY is not set");
    this.name = "MissingApiKeyError";
  }
}

export class InvalidApiKeyError extends Error {
  constructor() {
    super("GROQ_API_KEY was rejected by Groq");
    this.name = "InvalidApiKeyError";
  }
}

export class RateLimitedError extends Error {
  readonly retryAfterSeconds?: number;
  constructor(retryAfterSeconds?: number) {
    super("Rate limited by Groq");
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Thrown once both the initial call and the retry-with-brevity-nudge attempt
// still fail to produce parseable JSON (either Groq's json_object validator
// 400s on both attempts, or the content parses fine as a request but isn't
// valid JSON on both attempts). Distinct from a transport/auth failure —
// this is the model itself not cooperating, so it gets its own class rather
// than a generic Error the route would have to string-match on.
export class ModelOutputError extends Error {
  constructor() {
    super("Model did not return valid JSON after retry");
    this.name = "ModelOutputError";
  }
}

// Groq's API is OpenAI-compatible, so the OpenAI SDK works unmodified
// pointed at Groq's base URL. The constructor throws synchronously (at
// module load) if apiKey is falsy — fall back to a placeholder so a missing
// key surfaces as our own MissingApiKeyError from callJsonModel instead of
// crashing the whole route with an unhandled, unlogged exception.
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "unset",
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
  if (!process.env.GROQ_API_KEY) throw new MissingApiKeyError();

  for (let attempt = 0; attempt < 2; attempt++) {
    let completion;
    try {
      completion = await groq.chat.completions.create({
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
    } catch (err) {
      if (err instanceof AuthenticationError) throw new InvalidApiKeyError();
      if (err instanceof RateLimitError) {
        // Groq sends a Retry-After header (seconds) on 429s — surface the
        // actual wait instead of a vague "try again", since this model's
        // free-tier tokens-per-minute budget is small enough that an
        // immediate re-click reliably 429s again too.
        const header = err.headers?.get("retry-after");
        const seconds = header != null ? Number(header) : NaN;
        throw new RateLimitedError(Number.isFinite(seconds) ? seconds : undefined);
      }
      if (err instanceof APIError) {
        // Groq's own JSON-mode validator 400s when the model's output gets
        // truncated mid-object (e.g. max_tokens cut off a long ingredient
        // list) — that's recoverable the same way a client-side JSON.parse
        // failure is, so retry with the same brevity nudge instead of
        // failing outright on the first attempt.
        if (attempt === 0) {
          messages = [...messages, { role: "user", content: JSON_RETRY_SUFFIX }];
          continue;
        }
        throw new ModelOutputError();
      }
      throw err;
    }
    const raw = completion.choices[0]?.message?.content ?? "";
    try {
      return JSON.parse(raw);
    } catch {
      messages = [...messages, { role: "user", content: JSON_RETRY_SUFFIX }];
    }
  }
  throw new ModelOutputError();
}

export async function analyzeImage(imageDataUrl: string): Promise<unknown> {
  // Groq bills every image at a flat 2048 input tokens regardless of
  // dimensions, and the free tier's tokens-per-minute budget for this model
  // is small (on the order of 6000) — so max_tokens here isn't just tuned
  // against truncation anymore, it's tuned against how much of that
  // per-minute budget one call (and its worst-case one retry, which resends
  // the image) can eat before legitimate back-to-back photo analyses start
  // 429ing each other. 1500 fixed truncation but made two attempts
  // (2*(2048 image + ~150 prompt + 1500)) alone nearly exhaust the budget.
  // 700 + a lower 12-item cap (see ANALYZE_PROMPT) still comfortably covers
  // a typical shelf without needing the retry path, while leaving headroom
  // for a second real photo in the same minute.
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
    700,
  );
}

export async function generateRecipes(prompt: string): Promise<unknown> {
  return callJsonModel(TEXT_MODEL, [{ role: "user", content: prompt }], 1200);
}

/**
 * Maps a caught error from analyzeImage/generateRecipes to a safe client-facing
 * message + status, for the known/classified cases. Returns null for anything
 * else — callers should fall back to their own route-specific generic message.
 */
export function describeAiError(
  err: unknown,
): { message: string; status: number; retryAfterSeconds?: number } | null {
  if (err instanceof MissingApiKeyError) {
    return {
      message: "Server is missing GROQ_API_KEY — set it in your deployment's environment variables",
      status: 500,
    };
  }
  if (err instanceof InvalidApiKeyError) {
    return { message: "Groq rejected the configured GROQ_API_KEY — check it's correct and active", status: 500 };
  }
  if (err instanceof RateLimitedError) {
    // Groq's own Retry-After when it sends one, otherwise a conservative
    // guess at the tokens-per-minute window resetting. Exposed as a number
    // (not just baked into the message) so the client can wait it out and
    // retry automatically instead of making the user click again.
    const retryAfterSeconds = err.retryAfterSeconds != null ? Math.max(1, Math.ceil(err.retryAfterSeconds)) : 60;
    return {
      message: `Too many requests right now, retrying in ${retryAfterSeconds}s…`,
      status: 429,
      retryAfterSeconds,
    };
  }
  if (err instanceof ModelOutputError) {
    return { message: "Could not make sense of that, please try again", status: 502 };
  }
  return null;
}
