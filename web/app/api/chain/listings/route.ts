import { NextRequest, NextResponse } from "next/server";
import {
  CONTRACT_ADDRESS,
  genToAtto,
  getProviderClient,
  providerAddress,
  readAllListings,
  readListing,
  statusForError,
  waitFinalized,
} from "@/lib/genlayer-server";
import { DEFAULT_APPEAL_WINDOW_SECONDS } from "@/lib/constants";

export async function GET() {
  try {
    const listings = await readAllListings();
    return NextResponse.json({ listings });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}

interface CreateListingBody {
  modality: "TEXT" | "IMAGE" | "AUDIO";
  description: string;
  contentClauses: { type: string; value: string; weight: number }[];
  priceGen: number;
  deliverWindowSeconds?: number;
  appealWindowSeconds?: number;
  disputeBondGen?: number;
  requiresInput?: boolean;
  inputHint?: string;
}

// Dev-only demo-signing fallback for create_listing -- see
// NEXT_PUBLIC_ALLOW_DEMO_SIGNING in lib/chain-client.ts. A real visitor
// always signs this with their own connected wallet instead.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateListingBody;
  const priceAtto = genToAtto(body.priceGen);
  const disputeBondAtto = genToAtto(body.disputeBondGen ?? Math.round(body.priceGen * 1.5 * 100) / 100);

  try {
    const client = getProviderClient();
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "create_listing",
      args: [
        body.modality,
        body.description,
        body.contentClauses,
        priceAtto,
        body.deliverWindowSeconds ?? 3600,
        body.appealWindowSeconds ?? DEFAULT_APPEAL_WINDOW_SECONDS,
        disputeBondAtto,
        body.requiresInput ?? false,
        body.inputHint ?? "",
      ],
      value: 0n,
    });
    // Reads create_listing's own real return value (the exact listing_id
    // this transaction created) rather than a follow-up get_listing_count()
    // read -- the count-based approach can race a concurrent create_listing
    // from anyone else and silently hand back the wrong id (see
    // waitFinalized's own doc comment).
    const { returnValue } = await waitFinalized(client, hash as `0x${string}`);
    if (returnValue === undefined) {
      throw new Error("create_listing finalized but returned no listing_id -- cannot correlate");
    }
    const listingId = Number(returnValue);
    const listing = await readListing(listingId);
    return NextResponse.json({ listingId, listing, txHash: hash, provider: providerAddress() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
