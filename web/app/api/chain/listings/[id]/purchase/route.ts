import { NextRequest, NextResponse } from "next/server";
import {
  CONTRACT_ADDRESS,
  autoFulfillOrder,
  buyerAddress,
  genToAtto,
  getBuyerClient,
  readListing,
  readOrder,
  statusForError,
  waitFinalized,
} from "@/lib/genlayer-server";

// This runs the ENTIRE auto-fulfill pipeline in-request (generate+pin,
// submit_delivery write+finalize, adjudicate write+finalize) -- real
// measured totals this session ranged 180-225s. Without this, Vercel's
// default function timeout (10s Hobby, 60s Pro unless raised) would cut
// every purchase off mid-pipeline. NOTE: this route segment config caps at
// whatever your actual Vercel plan allows regardless of this number --
// Hobby is hard-capped at 60s no matter what maxDuration says, which is
// well under this pipeline's real duration. A Hobby-tier deployment WILL
// time out on real purchases; this needs at least Pro (300s default, up to
// 800s with Fluid compute) to actually work. Flagging this plainly rather
// than assuming -- confirm the target Vercel plan before relying on this.
export const maxDuration = 300;

// Dev-only demo-signing fallback for purchase() -- see
// NEXT_PUBLIC_ALLOW_DEMO_SIGNING in lib/chain-client.ts. A real visitor
// signs the purchase with their own connected wallet instead (see
// lib/chain-client.ts's purchaseListing, which calls
// /api/chain/orders/[id]/auto-fulfill itself right after its own purchase
// tx finalizes). This route does the equivalent for the demo path in one
// request: purchase, then immediately auto-fulfill -- payment succeeding IS
// the claim, and adjudication must stay automatic on every purchase
// regardless of which signing path was used.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = Number(id);
  const body = (await req.json().catch(() => ({}))) as {
    buyerInput?: string;
    buyerClauses?: { type: string; value: string; weight: number }[];
  };
  const buyerInput = body.buyerInput ?? "";
  const buyerClauses = body.buyerClauses ?? [];

  try {
    const client = getBuyerClient();
    const listing = await readListing(listingId);
    if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });
    if (!listing.active) {
      return NextResponse.json({ error: "[EXPECTED] listing is not active" }, { status: 400 });
    }
    // buyerInput is always optional now, regardless of listing.requiresInput --
    // that flag is UI guidance only (see lib/chain-client.ts / the listings/new
    // and browse pages), not an enforced requirement. No rejection here.

    const priceAtto = genToAtto(listing.priceGen);
    const purchaseHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "purchase",
      args: [listingId, buyerInput, buyerClauses],
      value: priceAtto,
    });
    // Reads purchase's own real return value (this transaction's exact
    // order_id) rather than a follow-up get_job_count() read, which can
    // race a concurrent purchase from anyone else and silently hand back
    // someone else's order id (see waitFinalized's own doc comment).
    const { returnValue } = await waitFinalized(client, purchaseHash as `0x${string}`);
    if (returnValue === undefined) {
      throw new Error("purchase finalized but returned no order_id -- cannot correlate");
    }
    const orderId = Number(returnValue);

    // Payment already finalized on-chain by this point -- a failure from
    // here on is a genuine post-payment fulfillment failure, not a purchase
    // failure, and must not be reported the same way (an error with no
    // orderId would leave the buyer with a paid order they can't find). See
    // autoFulfillOrder's own doc comment: it's safe to retry from wherever
    // the order's on-chain state actually is.
    try {
      const { order, cid, gatewayUrl } = await autoFulfillOrder(orderId);
      return NextResponse.json({ orderId, order, cid, gatewayUrl, txHash: purchaseHash, buyer: buyerAddress() });
    } catch (fulfillErr) {
      const order = await readOrder(orderId);
      return NextResponse.json(
        {
          orderId,
          order,
          txHash: purchaseHash,
          buyer: buyerAddress(),
          fulfillError: (fulfillErr as Error).message,
        },
        { status: 200 }
      );
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
