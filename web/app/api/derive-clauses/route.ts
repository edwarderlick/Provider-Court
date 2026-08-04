import { NextRequest, NextResponse } from "next/server";
import { deriveClauses } from "@/lib/derive-clauses";
import type { JobModality } from "@/lib/types";

const MODALITIES: JobModality[] = ["TEXT", "IMAGE", "AUDIO"];
const MAX_CLAUSES_CAP = 2;
const MAX_TEXT_LENGTH = 2000;
const MAX_CONTEXT_LENGTH = 2000;

// Real clause derivation, now in-process (see lib/derive-clauses.ts) -- no
// outbound fetch to a second service. Unlike /api/generate, this doesn't
// gate on an existing job/order -- derivation happens BEFORE either
// create_listing or purchase is ever signed, so there's nothing on-chain
// yet to check against. The actual listing/purchase transaction that
// follows still costs the caller a real wallet signature, which is what
// bounds how much this can be spammed for.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const modality = body?.modality;
  const text = body?.text;

  if (!modality || !MODALITIES.includes(modality)) {
    return NextResponse.json({ error: `modality must be one of ${MODALITIES.join(", ")}` }, { status: 400 });
  }
  if (typeof text !== "string") {
    return NextResponse.json({ error: "text must be a string" }, { status: 400 });
  }
  const maxClauses = Math.max(1, Math.min(Number(body?.maxClauses) || 2, MAX_CLAUSES_CAP));
  const forceWeight =
    Number.isInteger(body?.forceWeight) && body.forceWeight > 0 ? Math.min(body.forceWeight, 3) : undefined;

  try {
    const clauses = await deriveClauses(modality, text.slice(0, MAX_TEXT_LENGTH), maxClauses, {
      guaranteeFallback: Boolean(body?.guaranteeFallback),
      context: typeof body?.context === "string" ? body.context.slice(0, MAX_CONTEXT_LENGTH) : undefined,
      forceWeight,
    });
    return NextResponse.json({ clauses });
  } catch (err) {
    const message = err instanceof Error ? err.message : "clause derivation failed";
    console.error("derive-clauses error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
