import { NextResponse } from "next/server";
import { autoFulfillOrder, statusForError } from "@/lib/genlayer-server";

// See /api/chain/listings/[id]/purchase's own comment on this same value --
// this route runs the identical full pipeline (real measured totals
// 180-225s), just reached from the real-wallet path instead of the demo
// path. Same Vercel-plan caveat applies: Hobby's hard 60s cap will time
// this out regardless of this number; needs at least Pro.
export const maxDuration = 300;

// Task 2 of the provider-listed-services pivot: this is what makes
// generation + adjudication automatic instead of a manual provider
// "deliver" click. The buyer's own browser calls this immediately after
// its wallet-signed purchase() transaction finalizes (see
// lib/chain-client.ts's purchaseListing) -- everything from here on
// (generation, pinning, submit_delivery, adjudicate) is signed by the
// app's own fulfillment-operator key, not the buyer's or provider's
// wallet, so there is no second signature prompt anywhere in this flow.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { order, cid, gatewayUrl } = await autoFulfillOrder(Number(id));
    return NextResponse.json({ order, cid, gatewayUrl });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
