import OpenAI, { AuthenticationError, RateLimitError, APIError } from "openai";
import { ANALYZE_PROMPT, JSON_RETRY_SUFFIX } from "@/lib/prompts";

export class MissingApiKeyError extends Error {
  readonly envVar: string;
  constructor(envVar: string) {
    super(`${envVar} is not set`);
    this.name = "MissingApiKeyError";
    this.envVar = envVar;
  }
}

export class InvalidApiKeyError extends Error {
  readonly envVar: string;
  constructor(envVar: string) {
    super(`${envVar} was rejected`);
    this.name = "InvalidApiKeyError";
    this.envVar = envVar;
  }
}

export class RateLimitedError extends Error {
  readonly retryAfterSeconds?: number;
  constructor(retryAfterSeconds?: number) {
    super("Rate limited");
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Thrown once both the initial call and the retry-with-brevity-nudge attempt
// still fail to produce parseable JSON (either the API's own json_object
// validator 400s on both attempts, or the content parses fine as a request
// but isn't valid JSON on both attempts). Distinct from a transport/auth
// failure — this is the model itself not cooperating, so it gets its own
// class rather than a generic Error the route would have to string-match on.
export class ModelOutputError extends Error {
  constructor() {
    super("Model did not return valid JSON after retry");
    this.name = "ModelOutputError";
  }
}

// Both Groq and Gemini expose OpenAI-compatible chat completions endpoints,
// so the OpenAI SDK works unmodified pointed at either base URL — one client
// per provider. Each constructor throws synchronously (at module load) if
// apiKey is falsy — fall back to a placeholder so a missing key surfaces as
// our own MissingApiKeyError from callJsonModel instead of crashing the
// whole route with an unhandled, unlogged exception.
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "unset",
  baseURL: "https://api.groq.com/openai/v1",
});

const gemini = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY || "unset",
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

// Vision moved from Groq to Gemini: Groq's free tier only budgets ~6000
// tokens/minute for the vision model, and a flat 2048-token charge per image
// meant even a single retried call (which resends the image) could exhaust
// it, causing persistent 429s. Gemini's free tier budgets ~250,000
// tokens/minute for gemini-2.5-flash with no credit card required, which
// comfortably covers this app's usage. Recipe generation stays on Groq — it
// has no image cost and wasn't hitting the cap.
const VISION_MODEL = "gemini-2.5-flash";
const TEXT_MODEL = "openai/gpt-oss-120b";

async function callJsonModel(
  client: OpenAI,
  apiKeyEnvVar: string,
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxTokens: number,
  reasoningEffort: "none" | "low",
): Promise<unknown> {
  if (!process.env[apiKeyEnvVar]) throw new MissingApiKeyError(apiKeyEnvVar);

  for (let attempt = 0; attempt < 2; attempt++) {
    let completion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
        // Reasoning-capable models burn completion tokens on a hidden
        // "thinking" pass before the actual JSON — at default effort that
        // ate the whole max_tokens budget and truncated the JSON mid-object.
        // Gemini 2.5 Flash supports fully disabling it ("none"); Groq's
        // gpt-oss model doesn't support "none", so it stays at "low".
        reasoning_effort: reasoningEffort,
      } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
    } catch (err) {
      if (err instanceof AuthenticationError) throw new InvalidApiKeyError(apiKeyEnvVar);
      if (err instanceof RateLimitError) {
        // Surface the provider's actual Retry-After (seconds) when sent,
        // instead of a vague "try again" — lets the client wait it out and
        // retry automatically rather than requiring the user to notice and
        // retry by hand.
        const header = err.headers?.get("retry-after");
        const seconds = header != null ? Number(header) : NaN;
        throw new RateLimitedError(Number.isFinite(seconds) ? seconds : undefined);
      }
      if (err instanceof APIError) {
        // The API's own JSON-mode validator 400s when the model's output
        // gets truncated mid-object (e.g. max_tokens cut off a long
        // ingredient list) — that's recoverable the same way a client-side
        // JSON.parse failure is, so retry with the same brevity nudge
        // instead of failing outright on the first attempt.
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
  return callJsonModel(
    gemini,
    "GEMINI_API_KEY",
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
    1200,
    "none",
  );
}

export async function generateRecipes(prompt: string): Promise<unknown> {
  return callJsonModel(groq, "GROQ_API_KEY", TEXT_MODEL, [{ role: "user", content: prompt }], 1200, "low");
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
      message: `Server is missing ${err.envVar} — set it in your deployment's environment variables`,
      status: 500,
    };
  }
  if (err instanceof InvalidApiKeyError) {
    return { message: `${err.envVar} was rejected — check it's correct and active`, status: 500 };
  }
  if (err instanceof RateLimitedError) {
    // The provider's own Retry-After when it sends one, otherwise a
    // conservative guess at the tokens-per-minute window resetting. Exposed
    // as a number (not just baked into the message) so the client can wait
    // it out and retry automatically instead of making the user click again.
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
