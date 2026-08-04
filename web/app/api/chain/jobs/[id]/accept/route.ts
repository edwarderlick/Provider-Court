import { NextResponse } from "next/server";
import { CONTRACT_ADDRESS, getProviderClient, readJob, statusForError, waitFinalized } from "@/lib/genlayer-server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  try {
    const client = getProviderClient();
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "accept_job",
      args: [jobId],
      value: 0n,
    });
    await waitFinalized(client, hash as `0x${string}`);
    const job = await readJob(jobId);
    return NextResponse.json({ job, txHash: hash });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
