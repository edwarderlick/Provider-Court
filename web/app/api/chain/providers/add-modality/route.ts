import { NextRequest, NextResponse } from "next/server";
import {
  CONTRACT_ADDRESS,
  getProviderClient,
  providerAddress,
  readProvider,
  statusForError,
  waitFinalized,
} from "@/lib/genlayer-server";

interface AddModalityBody {
  modality: "TEXT" | "IMAGE" | "AUDIO";
}

// Dev-only demo-signing fallback for add_modality -- see
// NEXT_PUBLIC_ALLOW_DEMO_SIGNING in lib/chain-client.ts. A real visitor
// always signs this with their own connected wallet instead (see
// lib/chain-client.ts's addProviderModality).
export async function POST(req: NextRequest) {
  const body = (await req.json()) as AddModalityBody;
  try {
    const client = getProviderClient();
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "add_modality",
      args: [body.modality],
      value: 0n,
    });
    await waitFinalized(client, hash as `0x${string}`);
    const provider = await readProvider(providerAddress());
    return NextResponse.json({ provider, txHash: hash, address: providerAddress() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
