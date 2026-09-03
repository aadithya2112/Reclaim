import { describe, expect, it } from "bun:test";
import { cachedDemoProposal, DEMO_MESSAGE } from "@/lib/cached-commitment";
import { BUSINESS_TIMEZONE, type CommitmentContext } from "@/lib/commitment-interpreter";
import { interpretWithOpenRouter, OpenRouterError, type FetchLike } from "@/lib/openrouter";

const context: CommitmentContext = { recoveryCaseId: "rc", invoiceNumber: "INV-003", amountDuePaise: 7_500_000, amountRecoveredPaise: 0, currency: "INR", message: DEMO_MESSAGE, messageReceivedAt: "2026-09-03T10:00:00+05:30", businessTimezone: BUSINESS_TIMEZONE };
const output = cachedDemoProposal(context)!;
const ok = () => new Response(JSON.stringify({ provider: "OpenAI", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output), refusal: null } }] }), { status: 200 });

async function expectCode(fetchImpl: FetchLike, code: OpenRouterError["code"]) {
  try { await interpretWithOpenRouter(context, { apiKey: "test-key", fetchImpl, timeoutMs: 5 }); throw new Error("expected failure"); }
  catch (error) { expect(error).toBeInstanceOf(OpenRouterError); expect((error as OpenRouterError).code).toBe(code); }
}

describe("OpenRouter adapter", () => {
  it("sends strict schema with private compatible-provider routing and no tools", async () => {
    let requestBody: Record<string, unknown> = {};
    const result = await interpretWithOpenRouter(context, { apiKey: "test-key", fetchImpl: async (_url, init) => { requestBody = JSON.parse(String(init?.body)); return ok(); } });
    expect(result.output).toEqual(output);
    expect(requestBody.model).toBe("openai/gpt-5-mini");
    expect(requestBody).not.toHaveProperty("tools");
    expect(requestBody.provider).toEqual({ require_parameters: true, data_collection: "deny", zdr: true });
    expect(requestBody.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true } });
  });

  it("classifies malformed JSON, refusal, and truncation", async () => {
    await expectCode(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{" } }] }), { status: 200 }), "MALFORMED");
    await expectCode(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: null, refusal: "no" } }] }), { status: 200 }), "REFUSED");
    await expectCode(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }), { status: 200 }), "TRUNCATED");
  });

  it("classifies 402 without retry", async () => {
    let calls = 0;
    await expectCode(async () => { calls += 1; return new Response("{}", { status: 402 }); }, "PAYMENT_REQUIRED");
    expect(calls).toBe(1);
  });

  it("retries 429 once and relaxes only the ZDR preference", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const result = await interpretWithOpenRouter(context, { apiKey: "test-key", fetchImpl: async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return bodies.length === 1 ? new Response("{}", { status: 429 }) : ok(); } });
    expect(result.usedZdr).toBe(false);
    expect(bodies[1].provider).toEqual({ require_parameters: true, data_collection: "deny", zdr: false });
  });

  it("classifies repeated 5xx and timeout", async () => {
    await expectCode(async () => new Response("{}", { status: 503 }), "PROVIDER_UNAVAILABLE");
    await expectCode(async (_url, init) => await new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))), "TIMEOUT");
  });
});
