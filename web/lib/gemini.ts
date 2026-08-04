import type { GeneratedOutput } from "./generation-types";

// Confirmed live against ai.google.dev/gemini-api/docs/pricing on 2026-07-28:
// Gemini 3.6 Flash (released 2026-07-21) is Google's current default/latest
// Flash model and is listed free-of-charge on the free tier. Overridable via
// env in case Google ships a newer default before this code is revisited --
// see the Step 0 research note in README.md for how to re-verify.
export const DEFAULT_MODEL = "gemini-3.6-flash";

// A real 429 confirmed this project's free-tier allocation for
// gemini-3.6-flash specifically is `GenerateRequestsPerDayPerProjectPerModel-
// FreeTier, limit: 20` -- a DAILY cap (not the per-minute burst limit the
// error's own "retry in ~10s" hint might suggest), and 20 requests/day is
// genuinely too low for this app's real usage: a single order can involve
// up to three separate Gemini calls (listing-time clause derivation,
// purchase-time buyer-clause derivation, and the actual content
// generation), so 20/day caps out at well under 10 orders before every
// later purchase that day fails outright. Confirmed empirically (not
// assumed) that gemini-2.5-flash and gemini-flash-latest both had
// available capacity at the exact moment gemini-3.6-flash's own quota was
// fully exhausted -- Google scopes this quota per (project, model), so a
// different model is a genuinely separate pool, not the same bucket under
// another name. This is used ONLY as an automatic failover when the
// primary model's quota is actually exhausted (a real RESOURCE_EXHAUSTED/
// 429), never as a silent swap for any other kind of failure (a bad
// prompt, a malformed request, an actual outage) where switching models
// wouldn't help and would just obscure the real error.
export const FALLBACK_MODEL = "gemini-2.5-flash";

function isQuotaExhaustedMessage(message: string): boolean {
  return /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(message);
}

// Distinct from quota exhaustion: Google's own transient "the model is
// overloaded" response (observed directly against this API: "This model is
// currently experiencing high demand. Spikes in demand are usually
// temporary. Please try again later."), plus generic 5xx. Actually
// transient -- retrying the SAME model shortly after is the right response,
// unlike a daily quota wall which won't clear no matter how many times you
// ask again in the next few seconds.
function isTransientOverloadMessage(message: string): boolean {
  return /high demand|overloaded|UNAVAILABLE|Gemini API error \(50\d\)/i.test(message);
}

async function callGemini(model: string, apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const message = data?.error?.message || res.statusText;
    throw new Error(`Gemini API error (${res.status}): ${message}`);
  }

  const candidate = data?.candidates?.[0];
  const text: string | undefined = candidate?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");

  if (!text) {
    const reason = candidate?.finishReason ?? "unknown";
    throw new Error(`Gemini returned no text (finishReason: ${reason})`);
  }
  return text;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A short, bounded backoff for genuinely transient overload -- NOT used
// for quota exhaustion, which a few seconds of waiting cannot fix (see
// callGeminiWithFailover's own doc comment for why that case fails over to
// a different model instead of retrying).
async function callGeminiWithOverloadRetry(model: string, apiKey: string, prompt: string): Promise<string> {
  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callGemini(model, apiKey, prompt);
    } catch (err) {
      const message = (err as Error).message;
      if (i === attempts - 1 || !isTransientOverloadMessage(message)) throw err;
      await sleep(1000 * 2 ** i);
    }
  }
  throw new Error("unreachable");
}

// Shared by generateText (below) and derive-clauses.ts -- both call the
// same underlying model and are both subject to the same daily quota, so
// both need the same failover behavior rather than duplicating it.
//
// Two distinct failure modes get two distinct responses:
// - Transient overload ("high demand", 5xx): short bounded retry against
//   the SAME model, since this really does clear up within seconds.
// - Daily quota exhaustion (confirmed via a real 429: `Generate
//   RequestsPerDayPerProjectPerModel-FreeTier, limit: 20` for the primary
//   model) will NOT clear up within any retry window worth waiting for --
//   retrying the same model is pure waste. Failing over once to
//   FALLBACK_MODEL is the actual fix, since Google scopes this quota per
//   (project, model) and a different model is a genuinely separate pool
//   (confirmed empirically: gemini-2.5-flash and gemini-flash-latest both
//   had capacity at the exact moment gemini-3.6-flash's was exhausted).
export async function callGeminiWithFailover(
  prompt: string
): Promise<{ text: string; modelUsed: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  try {
    return { text: await callGeminiWithOverloadRetry(primary, apiKey, prompt), modelUsed: primary };
  } catch (err) {
    const message = (err as Error).message;
    if (primary === FALLBACK_MODEL || !isQuotaExhaustedMessage(message)) throw err;
    console.error(
      `Gemini primary model ${primary}'s quota is exhausted, failing over to ${FALLBACK_MODEL}:`,
      message
    );
    const text = await callGeminiWithOverloadRetry(FALLBACK_MODEL, apiKey, prompt);
    return { text, modelUsed: FALLBACK_MODEL };
  }
}

export async function generateText(prompt: string): Promise<GeneratedOutput> {
  const { text } = await callGeminiWithFailover(prompt);
  return {
    buffer: Buffer.from(text, "utf-8"),
    contentType: "text/plain; charset=utf-8",
    extension: "txt",
  };
}
