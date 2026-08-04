import { NextResponse } from "next/server";
import {
  CONTRACT_ADDRESS,
  genToAtto,
  getBuyerClient,
  readJob,
  statusForError,
  waitFinalized,
} from "@/lib/genlayer-server";

// The contract allows either the buyer or the assigned provider to appeal.
// This UI's appeal flow is only reachable from the buyer-facing job page, so
// the buyer demo account signs here -- a provider-side appeal isn't part of
// this frontend's flow (no separate "acting as provider" context on this page).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);

  const job = await readJob(jobId);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  try {
    const client = getBuyerClient();
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "appeal",
      args: [jobId],
      value: genToAtto(job.disputeBondGen ?? 0),
    });
    await waitFinalized(client, hash as `0x${string}`);
    const updatedJob = await readJob(jobId);
    return NextResponse.json({ job: updatedJob, txHash: hash });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
