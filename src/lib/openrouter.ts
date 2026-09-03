import { z } from "zod";
import {
  buildInterpreterSystemPrompt,
  commitmentJsonSchema,
  type CommitmentContext,
  COMMITMENT_SCHEMA_VERSION,
} from "@/lib/commitment-interpreter";

export const OPENROUTER_MODEL = "openai/gpt-5-mini";
export const OPENROUTER_PROVIDER_POLICY_VERSION = "openrouter-private-routing-v2";

export type OpenRouterFailureCode = "AUTH" | "PAYMENT_REQUIRED" | "RATE_LIMITED" | "PROVIDER_UNAVAILABLE" | "TIMEOUT" | "REFUSED" | "TRUNCATED" | "MALFORMED" | "INVALID_RESPONSE";

export class OpenRouterError extends Error {
  constructor(public readonly code: OpenRouterFailureCode, message: string, public readonly status?: number) {
    super(message);
    this.name = "OpenRouterError";
  }
}

const responseSchema = z.object({
  provider: z.string().optional(),
  choices: z.array(z.object({
    finish_reason: z.string().nullable().optional(),
    message: z.object({
      content: z.string().nullable(),
      refusal: z.string().nullable().optional(),
    }),
  })).min(1),
});

function failureForStatus(status: number) {
  if (status === 401 || status === 403) return "AUTH" as const;
  if (status === 402) return "PAYMENT_REQUIRED" as const;
  if (status === 429) return "RATE_LIMITED" as const;
  return "PROVIDER_UNAVAILABLE" as const;
}

function safeErrorDetail(body: unknown) {
  const parsed = z.object({ error: z.object({ message: z.string().max(500) }) }).safeParse(body);
  return parsed.success ? parsed.data.error.message : null;
}

export type OpenRouterResult = {
  output: unknown;
  provider: string | null;
  latencyMs: number;
  usedZdr: boolean;
  privacyMode: "ZDR" | "DATA_COLLECTION_DENY";
  fallbackReason: OpenRouterFailureCode | null;
};
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function interpretWithOpenRouter(
  context: CommitmentContext,
  options: { apiKey?: string; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<OpenRouterResult> {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new OpenRouterError("AUTH", "OPENROUTER_API_KEY is not configured");
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const started = Date.now();
  let lastError: OpenRouterError | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
          "X-Title": "Recoup Decision Replay",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: "system", content: buildInterpreterSystemPrompt() },
            { role: "user", content: JSON.stringify({ schema_version: COMMITMENT_SCHEMA_VERSION, observable_case: context }) },
          ],
          response_format: { type: "json_schema", json_schema: { name: "recovery_commitment", strict: true, schema: commitmentJsonSchema } },
          provider: { require_parameters: true, data_collection: "deny", zdr: attempt === 0 },
          reasoning: { effort: "minimal", exclude: true },
          max_tokens: 3_000,
          stream: false,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      const responseText = await response.text();
      let body: unknown = null;
      try { body = JSON.parse(responseText); } catch { body = null; }
      if (!response.ok) {
        const code = failureForStatus(response.status);
        const detail = safeErrorDetail(body);
        const error = new OpenRouterError(code, `OpenRouter request failed (${response.status})${detail ? `: ${detail}` : ""}`, response.status);
        if (attempt === 0 && (code === "RATE_LIMITED" || code === "PROVIDER_UNAVAILABLE")) { lastError = error; continue; }
        throw error;
      }
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) {
        const shape = body === null ? "null" : Array.isArray(body) ? "array" : typeof body === "object" ? `object(${Object.keys(body).join(",")})` : typeof body;
        throw new OpenRouterError("INVALID_RESPONSE", `OpenRouter returned an invalid response envelope (${shape}): ${parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.code}`).join(", ")}`);
      }
      const choice = parsed.data.choices[0];
      if (choice.message.refusal) throw new OpenRouterError("REFUSED", "The model refused the structured extraction");
      if (choice.finish_reason === "length") throw new OpenRouterError("TRUNCATED", "The structured extraction was truncated");
      if (!choice.message.content) throw new OpenRouterError("MALFORMED", "The model returned no structured content");
      let output: unknown;
      try { output = JSON.parse(choice.message.content); } catch { throw new OpenRouterError("MALFORMED", "The model returned malformed JSON"); }
      return {
        output,
        provider: parsed.data.provider ?? null,
        latencyMs: Date.now() - started,
        usedZdr: attempt === 0,
        privacyMode: attempt === 0 ? "ZDR" : "DATA_COLLECTION_DENY",
        fallbackReason: attempt === 0 ? null : lastError?.code ?? "PROVIDER_UNAVAILABLE",
      };
    } catch (error) {
      if (error instanceof OpenRouterError) throw error;
      const timedOut = error instanceof Error && error.name === "AbortError";
      const wrapped = new OpenRouterError(timedOut ? "TIMEOUT" : "PROVIDER_UNAVAILABLE", timedOut ? "OpenRouter request timed out" : "OpenRouter is unavailable");
      if (attempt === 0) { lastError = wrapped; continue; }
      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new OpenRouterError("PROVIDER_UNAVAILABLE", "OpenRouter is unavailable");
}
