import { NextResponse } from "next/server";
import { CONTRACT_ADDRESS, getBuyerClient, readJob, statusForError, waitFinalized } from "@/lib/genlayer-server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);

  const job = await readJob(jobId);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  if (!job.cid) return NextResponse.json({ error: "job has no delivered cid" }, { status: 400 });

  try {
    const client = getBuyerClient();
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "resolve_appeal",
      args: [jobId, job.cid],
      value: 0n,
    });
    await waitFinalized(client, hash as `0x${string}`);
    const updatedJob = await readJob(jobId);
    return NextResponse.json({ job: updatedJob, txHash: hash });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
