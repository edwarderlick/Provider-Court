import { NextRequest, NextResponse } from "next/server";
import {
  CONTRACT_ADDRESS,
  buyerAddress,
  genToAtto,
  getBuyerClient,
  readAllJobs,
  statusForError,
  waitFinalized,
} from "@/lib/genlayer-server";
import { DEFAULT_APPEAL_WINDOW_SECONDS } from "@/lib/constants";

export async function GET() {
  try {
    const jobs = await readAllJobs();
    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}

interface CreateJobBody {
  modality: "TEXT" | "IMAGE" | "AUDIO";
  prompt: string;
  clauses: { type: string; value: string; weight: number }[];
  rewardGen: number;
  acceptWindowSeconds?: number;
  deliverWindowSeconds?: number;
  appealWindowSeconds?: number;
}

// Mirrors the UI's single "Confirm & Fund" button: create_job and fund_job
// are executed back-to-back as one buyer-signed action, matching the
// existing frontend flow rather than splitting it into two separate steps.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateJobBody;
  const rewardAtto = genToAtto(body.rewardGen);
  const disputeBondAtto = genToAtto(Math.round(body.rewardGen * 1.5 * 100) / 100);

  try {
    const client = getBuyerClient();
    const createHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "create_job",
      args: [
        body.modality,
        body.prompt,
        body.clauses,
        rewardAtto,
        body.acceptWindowSeconds ?? 3600,
        body.deliverWindowSeconds ?? 3600,
        body.appealWindowSeconds ?? DEFAULT_APPEAL_WINDOW_SECONDS,
        disputeBondAtto,
      ],
      value: 0n,
    });
    // Reads create_job's own real return value (this transaction's exact
    // job_id) rather than a follow-up get_job_count() read, which can race
    // a concurrent create_job from anyone else (see waitFinalized's own
    // doc comment).
    const { returnValue } = await waitFinalized(client, createHash as `0x${string}`);
    if (returnValue === undefined) {
      throw new Error("create_job finalized but returned no job_id -- cannot correlate");
    }
    const jobId = Number(returnValue);

    const fundHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "fund_job",
      args: [jobId],
      value: rewardAtto,
    });
    await waitFinalized(client, fundHash as `0x${string}`);

    return NextResponse.json({ jobId, createTxHash: createHash, fundTxHash: fundHash, buyer: buyerAddress() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
