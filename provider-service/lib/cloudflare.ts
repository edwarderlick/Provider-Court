import type { GeneratedOutput } from "./types";

// Cloudflare Workers AI has been observed returning a generic, transient
// "AiError: Invalid input" for a request that succeeds unmodified on
// immediate retry (confirmed directly: the exact same prompt that failed
// through the app succeeded seconds later called straight against the API)
// -- this is upstream flakiness, not a real validation failure, so a short
// bounded retry is warranted rather than surfacing it as a hard failure.
async function withTransientRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
    }
  }
  throw lastErr;
}

// Confirmed live against developers.cloudflare.com/workers-ai/models/ on
// 2026-07-28. Both are current (non-deprecated) catalog entries and cheap
// against the free 10,000-Neuron/day pool (Flux schnell ~4.8 neurons per
// 512x512 tile; MeloTTS ~$0.0002/audio-minute equivalent). Overridable via
// env if the catalog moves on.
const DEFAULT_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const DEFAULT_AUDIO_MODEL = "@cf/myshell-ai/melotts";

function baseUrl(accountId: string, model: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
}

function requireCfEnv(): { accountId: string; token: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is not set");
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is not set");
  return { accountId, token };
}

/**
 * Cloudflare Workers AI's REST responses are inconsistent across model
 * families: some return `{result: {<field>: "<base64>"}, success}`, others
 * stream the raw binary directly with the matching Content-Type. This reads
 * whichever shape actually comes back rather than assuming one.
 */
async function runAndExtractBinary(
  res: Response,
  base64Field: string
): Promise<Buffer> {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = (await res.json()) as any;
    if (data?.success === false) {
      const message = data?.errors?.[0]?.message || "unknown error";
      throw new Error(`Cloudflare Workers AI error: ${message}`);
    }
    const b64: string | undefined = data?.result?.[base64Field] ?? data?.[base64Field];
    if (!b64) {
      throw new Error(
        `Cloudflare Workers AI returned JSON with no "${base64Field}" field: ${JSON.stringify(data).slice(0, 300)}`
      );
    }
    return Buffer.from(b64, "base64");
  }

  // Not JSON -> assume raw binary body.
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateImage(prompt: string): Promise<GeneratedOutput> {
  const { accountId, token } = requireCfEnv();
  const model = process.env.CLOUDFLARE_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;

  return withTransientRetry(async () => {
    const res = await fetch(baseUrl(accountId, model), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok && !(res.headers.get("content-type") || "").includes("application/json")) {
      throw new Error(`Cloudflare Workers AI error (${res.status}): ${res.statusText}`);
    }

    const buffer = await runAndExtractBinary(res, "image");
    return { buffer, contentType: "image/jpeg", extension: "jpg" };
  });
}

export async function generateAudio(prompt: string): Promise<GeneratedOutput> {
  const { accountId, token } = requireCfEnv();
  const model = process.env.CLOUDFLARE_AUDIO_MODEL || DEFAULT_AUDIO_MODEL;

  return withTransientRetry(async () => {
    const res = await fetch(baseUrl(accountId, model), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // MeloTTS's documented input field is `prompt` (the text to speak), not
      // `text` -- confirmed against the model's own docs page.
      body: JSON.stringify({ prompt, lang: "en" }),
    });

    if (!res.ok && !(res.headers.get("content-type") || "").includes("application/json")) {
      throw new Error(`Cloudflare Workers AI error (${res.status}): ${res.statusText}`);
    }

    const buffer = await runAndExtractBinary(res, "audio");
    return { buffer, contentType: "audio/mpeg", extension: "mp3" };
  });
}
