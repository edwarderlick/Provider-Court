import { NextRequest, NextResponse } from "next/server";
import {
  CONTRACT_ADDRESS,
  getProviderClient,
  providerAddress,
  readProvider,
  statusForError,
  waitFinalized,
} from "@/lib/genlayer-server";

interface RegisterBody {
  modalities: ("TEXT" | "IMAGE" | "AUDIO")[];
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RegisterBody;
  try {
    const client = getProviderClient();
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "register_provider",
      args: [body.modalities],
      value: 0n,
    });
    await waitFinalized(client, hash as `0x${string}`);
    const provider = await readProvider(providerAddress());
    return NextResponse.json({ provider, txHash: hash, address: providerAddress() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
