/**
 * Standalone test harness -- calls the lib/ functions directly (no HTTP
 * server needed) so this can run before the frontend is wired to the
 * service at all. Run with: npm run test:harness
 *
 * Requires a .env.local with GEMINI_API_KEY, CLOUDFLARE_ACCOUNT_ID,
 * CLOUDFLARE_API_TOKEN, PINATA_JWT set (see .env.example).
 */
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { generateText } from "../lib/gemini";
import { generateImage, generateAudio } from "../lib/cloudflare";
import { pinToIPFS } from "../lib/pinata";
import type { GeneratedOutput, Modality } from "../lib/types";

config({ path: ".env.local" });

interface SampleJob {
  modality: Modality;
  prompt: string;
}

const SAMPLE_JOBS: SampleJob[] = [
  {
    modality: "TEXT",
    prompt:
      "Write a 2-sentence technical summary of how clause-based escrow works for AI-generated deliverables.",
  },
  {
    modality: "IMAGE",
    prompt:
      "A high-contrast macro photograph of a circuit board with glowing orange LEDs, brutalist industrial aesthetic, warm off-white background.",
  },
  {
    modality: "AUDIO",
    prompt:
      "Welcome to Provider Court, the intelligent escrow protocol for AI-generated work.",
  },
];

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function generate(job: SampleJob): Promise<GeneratedOutput> {
  switch (job.modality) {
    case "TEXT":
      return generateText(job.prompt);
    case "IMAGE":
      return generateImage(job.prompt);
    case "AUDIO":
      return generateAudio(job.prompt);
  }
}

async function verifyGatewayConsistency(
  gatewayUrl: string,
  expectedHash: string,
  attempts = 5,
  delayMs = 3000
): Promise<{ ok: boolean; detail: string }> {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(gatewayUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const hash = sha256(buf);
        if (hash === expectedHash) {
          return { ok: true, detail: `byte-identical on attempt ${i}/${attempts}` };
        }
        return {
          ok: false,
          detail: `HASH MISMATCH on attempt ${i}: expected ${expectedHash}, got ${hash}`,
        };
      }
    } catch (e) {
      // fall through to retry
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ok: false, detail: `gateway never returned 200 after ${attempts} attempts` };
}

async function main() {
  const missing = ["GEMINI_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "PINATA_JWT"].filter(
    (k) => !process.env[k]
  );
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    console.error("Copy .env.example to .env.local and fill in real values first.");
    process.exit(1);
  }

  const results: Array<{ job: SampleJob; cid: string; gatewayUrl: string; verified: boolean }> = [];

  for (const job of SAMPLE_JOBS) {
    console.log(`\n=== ${job.modality} ===`);
    console.log(`prompt: ${job.prompt}`);
    const start = Date.now();
    try {
      const output = await generate(job);
      const genMs = Date.now() - start;
      console.log(`generated ${output.buffer.length} bytes (${output.contentType}) in ${genMs}ms`);

      const localHash = sha256(output.buffer);
      const pinned = await pinToIPFS(output, `harness-${job.modality.toLowerCase()}-${Date.now()}.${output.extension}`);
      console.log(`pinned: cid=${pinned.cid}`);
      console.log(`gateway: ${pinned.gatewayUrl}`);

      console.log("verifying gateway serves byte-identical content...");
      const check = await verifyGatewayConsistency(pinned.gatewayUrl, localHash);
      console.log(check.ok ? `OK: ${check.detail}` : `FAILED: ${check.detail}`);

      results.push({ job, cid: pinned.cid, gatewayUrl: pinned.gatewayUrl, verified: check.ok });
    } catch (err) {
      console.error(`FAILED (${job.modality}):`, err instanceof Error ? err.message : err);
      results.push({ job, cid: "", gatewayUrl: "", verified: false });
    }
  }

  console.log("\n\n=== SUMMARY ===");
  for (const r of results) {
    console.log(
      `${r.job.modality.padEnd(6)} ${r.verified ? "OK  " : "FAIL"}  cid=${r.cid || "(none)"}  ${r.gatewayUrl}`
    );
  }

  const anyFailed = results.some((r) => !r.verified);
  process.exit(anyFailed ? 1 : 0);
}

main();
