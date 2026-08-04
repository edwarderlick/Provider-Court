import "server-only";

// Real stage tracking for autoFulfillOrder's pipeline, used to drive Issue
// 3's stage-by-stage progress UI. This exists because the on-chain state
// machine alone can't show it: generation+pinning and the two write+wait
// steps all happen INSIDE a single Accepted->Delivered (or
// Delivered->settled) transition from the chain's point of view -- polling
// get_order during that window would just see the same state repeatedly,
// then jump straight to the end. These stages are set at the exact point
// each real step starts in autoFulfillOrder itself, not decorative --
// there's no separate timer or animation driving this, just a plain record
// of which real await is currently in flight.
//
// Deployed on Vercel, a single in-memory Map is not reliable: the POST that
// sets a stage and the GET that polls it can land on different serverless
// function instances (different cold starts, no shared memory between
// them), so the progress UI could sit frozen even while the real pipeline
// is progressing correctly. If Vercel KV is provisioned and linked to this
// project, KV_REST_API_URL/KV_REST_API_TOKEN are injected automatically --
// when present, every read/write here goes through KV's REST API instead
// (plain fetch, no SDK dependency needed for two commands) so state is
// genuinely shared across instances. Without those env vars (local dev, or
// simply not provisioned yet), this falls back to the exact in-memory Map
// this always used -- correct for a single long-running local dev server,
// same known limitation as before if actually deployed without KV.
export type FulfillStage = "generating" | "delivering" | "consensus";

interface ProgressEntry {
  stage: FulfillStage;
  since: number;
}

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const useKv = Boolean(KV_URL && KV_TOKEN);

// Generous ceiling matching tx-lock.ts's own 10-minute stale-lock window --
// this is a safety net against an entry never getting cleared (a crash mid
// pipeline), not a real expected duration.
const KV_TTL_SECONDS = 10 * 60;

function kvKey(orderId: number): string {
  return `fulfill-progress:${orderId}`;
}

async function kvCommand(...args: string[]): Promise<unknown> {
  const path = args.map(encodeURIComponent).join("/");
  const res = await fetch(`${KV_URL}/${path}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`KV command failed: ${data?.error ?? res.statusText}`);
  return data?.result ?? null;
}

const memory = new Map<number, ProgressEntry>();

export async function setFulfillStage(orderId: number, stage: FulfillStage): Promise<void> {
  const entry: ProgressEntry = { stage, since: Date.now() };
  if (useKv) {
    await kvCommand("set", kvKey(orderId), JSON.stringify(entry), "EX", String(KV_TTL_SECONDS));
    return;
  }
  memory.set(orderId, entry);
}

export async function getFulfillStage(
  orderId: number
): Promise<{ stage: FulfillStage; sinceMs: number } | null> {
  if (useKv) {
    const raw = await kvCommand("get", kvKey(orderId));
    if (!raw) return null;
    const entry = JSON.parse(raw as string) as ProgressEntry;
    return { stage: entry.stage, sinceMs: Date.now() - entry.since };
  }
  const entry = memory.get(orderId);
  if (!entry) return null;
  return { stage: entry.stage, sinceMs: Date.now() - entry.since };
}

export async function clearFulfillStage(orderId: number): Promise<void> {
  if (useKv) {
    await kvCommand("del", kvKey(orderId));
    return;
  }
  memory.delete(orderId);
}
