import type { VercelRequest, VercelResponse } from "@vercel/node";
import { deriveClauses } from "../lib/derive-clauses";
import type { Modality } from "../lib/types";

const MODALITIES: Modality[] = ["TEXT", "IMAGE", "AUDIO"];
const MAX_CLAUSES_CAP = 2;
const MAX_TEXT_LENGTH = 2000;
const MAX_CONTEXT_LENGTH = 2000;

interface DeriveClausesRequest {
  modality: Modality;
  text: string;
  maxClauses?: number;
  guaranteeFallback?: boolean;
  context?: string;
  forceWeight?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed, use POST" });
    return;
  }

  const body = req.body as Partial<DeriveClausesRequest> | undefined;
  const modality = body?.modality;
  const text = body?.text;

  if (!modality || !MODALITIES.includes(modality)) {
    res.status(400).json({ error: `modality must be one of ${MODALITIES.join(", ")}` });
    return;
  }
  if (typeof text !== "string") {
    res.status(400).json({ error: "text must be a string" });
    return;
  }
  const maxClauses = Math.max(1, Math.min(Number(body?.maxClauses) || 2, MAX_CLAUSES_CAP));

  const forceWeight =
    Number.isInteger(body?.forceWeight) && (body!.forceWeight as number) > 0
      ? Math.min(body!.forceWeight as number, 3)
      : undefined;

  try {
    const clauses = await deriveClauses(modality, text.slice(0, MAX_TEXT_LENGTH), maxClauses, {
      guaranteeFallback: Boolean(body?.guaranteeFallback),
      context: typeof body?.context === "string" ? body.context.slice(0, MAX_CONTEXT_LENGTH) : undefined,
      forceWeight,
    });
    res.status(200).json({ clauses });
  } catch (err) {
    const message = err instanceof Error ? err.message : "clause derivation failed";
    console.error("derive-clauses error:", message);
    res.status(502).json({ error: message });
  }
}
