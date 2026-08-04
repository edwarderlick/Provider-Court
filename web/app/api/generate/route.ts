import { NextRequest, NextResponse } from "next/server";
import { countConcurrentAccepted, MAX_CONCURRENT_ACCEPTED_PER_PROVIDER, readJob } from "@/lib/genlayer-server";
import { generateContent } from "@/lib/generate-content";
import type { JobModality } from "@/lib/types";

// Real image/audio generation calls can run long -- this is the Next.js App
// Router equivalent of the former provider-service/vercel.json's
// `functions["api/generate.ts"].maxDuration: 60`, since that per-file
// config only applied to that now-removed separate Vercel project.
export const maxDuration = 60;

const MODALITIES: JobModality[] = ["TEXT", "IMAGE", "AUDIO"];

// Real generation, now in-process (see lib/generate-content.ts) -- no
// outbound fetch to a second service. Still a public HTTP endpoint though
// (nothing currently calls it -- autoFulfillOrder and the legacy deliver
// route both call generateContent() directly in-process now -- but it stays
// reachable over HTTP for parity with the original provider-service API
// shape), so it keeps the exact same guard this route already had before
// the merge: without checking jobId/address/state first, this would be a
// genuinely open drain on real Gemini/Cloudflare Workers AI/Pinata quota for
// anyone who found the URL, with no job, no wallet, and no on-chain action
// at all.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { modality, prompt, jobId, address } = body ?? {};

  if (jobId === undefined || jobId === null || typeof address !== "string" || !address) {
    return NextResponse.json({ error: "jobId and address are required" }, { status: 400 });
  }
  if (!modality || !MODALITIES.includes(modality)) {
    return NextResponse.json({ error: `modality must be one of ${MODALITIES.join(", ")}` }, { status: 400 });
  }
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "prompt must be a non-empty string" }, { status: 400 });
  }

  const job = await readJob(Number(jobId));
  if (!job) {
    return NextResponse.json({ error: `job ${jobId} not found` }, { status: 404 });
  }
  if (job.state !== "Accepted") {
    return NextResponse.json(
      { error: `job ${jobId} is not in Accepted state (currently ${job.state})` },
      { status: 409 }
    );
  }
  if (job.providerId?.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json(
      { error: `job ${jobId} is not assigned to ${address}` },
      { status: 403 }
    );
  }

  const inFlight = await countConcurrentAccepted(address, Number(jobId));
  if (inFlight >= MAX_CONCURRENT_ACCEPTED_PER_PROVIDER) {
    return NextResponse.json(
      {
        error: `provider ${address} already has ${inFlight} other accepted jobs in flight (max ${MAX_CONCURRENT_ACCEPTED_PER_PROVIDER}) -- deliver or let them expire before generating another`,
      },
      { status: 429 }
    );
  }

  try {
    const response = await generateContent(modality, prompt);
    return NextResponse.json(response);
  } catch (err) {
    // Never forward raw provider error bodies to the client -- lib/gemini.ts,
    // lib/cloudflare.ts, and lib/pinata.ts already strip anything key-shaped,
    // but keep this as a second line of defense against accidentally
    // leaking upstream detail.
    const message = err instanceof Error ? err.message : "generation failed";
    console.error("generate error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
