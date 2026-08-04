import { NextResponse } from "next/server";
import { CONTRACT_ADDRESS, getBuyerClient, readJob, statusForError, waitFinalized } from "@/lib/genlayer-server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  try {
    const client = getBuyerClient();
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "claim_settlement",
      args: [jobId],
      value: 0n,
    });
    await waitFinalized(client, hash as `0x${string}`);
    const updatedJob = await readJob(jobId);
    return NextResponse.json({ job: updatedJob, txHash: hash });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
