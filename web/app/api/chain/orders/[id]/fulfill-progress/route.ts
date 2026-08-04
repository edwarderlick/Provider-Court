import { NextResponse } from "next/server";
import { getFulfillStage } from "@/lib/fulfill-progress";

// Polled by the order detail page while state is Accepted/Delivered to show
// which real pipeline stage is currently running (see lib/fulfill-progress.ts
// for why this can't be derived from on-chain state alone). No stage entry
// just means autoFulfillOrder isn't currently running for this order --
// either it hasn't started yet, or it already finished (chain state itself
// covers that case at that point).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const progress = await getFulfillStage(Number(id));
  return NextResponse.json({ progress });
}
