import { NextResponse } from "next/server";
import {
  CONTRACT_ADDRESS,
  countConcurrentAccepted,
  getProviderClient,
  MAX_CONCURRENT_ACCEPTED_PER_PROVIDER,
  providerAddress,
  readJob,
  statusForError,
  waitFinalized,
} from "@/lib/genlayer-server";
import { generateContent } from "@/lib/generate-content";

// Real image/audio generation calls can run long -- see /api/generate's own
// comment for why this route segment config is what's actually needed
// (rather than the old provider-service/vercel.json's per-file config,
// which only applied to that now-removed separate deployment).
export const maxDuration = 60;

// Real accept->deliver step: generates the job's content and pins it
// in-process (see lib/generate-content.ts -- merged in from the former
// provider-service project, no outbound fetch to a second service), then
// submits the real returned CID on-chain via submit_delivery.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);

  const job = await readJob(jobId);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  // This route calls a real, quota-limited external backend (Gemini/
  // Cloudflare Workers AI/Pinata) before ever touching the chain. Without
  // checking job.state first, a bare POST loop against this endpoint --
  // regardless of whether the job could ever actually be delivered -- would
  // burn that quota for nothing; submit_delivery's own on-chain check
  // (state must be Accepted, sender must be job.provider) only protects the
  // chain, not the backend call that happens before it.
  if (job.state !== "Accepted") {
    return NextResponse.json(
      { error: `job ${jobId} is not in Accepted state (currently ${job.state})` },
      { status: 409 }
    );
  }
  const demoProvider = providerAddress();
  if (job.providerId?.toLowerCase() !== demoProvider.toLowerCase()) {
    return NextResponse.json(
      { error: `job ${jobId} is not assigned to the demo provider account` },
      { status: 403 }
    );
  }
  const inFlight = await countConcurrentAccepted(demoProvider, jobId);
  if (inFlight >= MAX_CONCURRENT_ACCEPTED_PER_PROVIDER) {
    return NextResponse.json(
      {
        error: `demo provider account already has ${inFlight} other accepted jobs in flight (max ${MAX_CONCURRENT_ACCEPTED_PER_PROVIDER})`,
      },
      { status: 429 }
    );
  }

  try {
    const genData = await generateContent(job.modality, job.prompt);
    const cid: string = genData.cid;

    const client = getProviderClient();
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "submit_delivery",
      args: [jobId, cid],
      value: 0n,
    });
    await waitFinalized(client, hash as `0x${string}`);
    const updatedJob = await readJob(jobId);
    return NextResponse.json({ job: updatedJob, txHash: hash, cid, gatewayUrl: genData.gatewayUrl });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
