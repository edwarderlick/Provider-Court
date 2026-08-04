import { NextResponse } from "next/server";
import { CONTRACT_ADDRESS, getProviderClient, readListing, statusForError, waitFinalized } from "@/lib/genlayer-server";

// Dev-only demo-signing fallback -- see NEXT_PUBLIC_ALLOW_DEMO_SIGNING in
// lib/chain-client.ts. A real visitor signs set_listing_active with their
// own connected wallet instead (see lib/chain-client.ts's deactivateListing).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = Number(id);
  try {
    const client = getProviderClient();
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "set_listing_active",
      args: [listingId, false],
      value: 0n,
    });
    await waitFinalized(client, hash as `0x${string}`);
    const listing = await readListing(listingId);
    return NextResponse.json({ listing, txHash: hash });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
