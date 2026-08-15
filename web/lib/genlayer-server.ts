import "server-only";
import { createAccount, createClient, simplifyTransactionReceipt } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { attoToGen, genToAtto } from "./atto";
import { clearFulfillStage, setFulfillStage } from "./fulfill-progress";
import { mapWithConcurrency, withBusyRetry } from "./rpc-retry";
import { generateContent } from "./generate-content";
import { ClauseVerdict, Job, JobModality, JobState, Listing, Order, Provider } from "./types";

export { attoToGen, genToAtto };

// Server-only wiring against the Studio deployment of the Provider Court
// escrow contract, used for: (a) all reads (no signing needed), and (b) the
// dev-only demo-account fallback writes for local testing without a wallet
// (see lib/genlayer-wallet.ts + lib/chain-client.ts for the real
// wallet-signed write path, which is now the default for any real visitor).

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see web/.env.local)`);
  return value;
}

export const CONTRACT_ADDRESS = requiredEnv("GENLAYER_CONTRACT_ADDRESS") as `0x${string}`;

// Server-side enforcement for the demo-signing fallback. NEXT_PUBLIC_ALLOW_
// DEMO_SIGNING (lib/chain-client.ts) only controls what the FRONTEND offers
// as a signing path -- every API route that actually signs with the fixed
// demo buyer/provider keys was still willing to do so unconditionally for
// anyone who called it directly, regardless of that flag. This is the real
// boundary: both getBuyerClient() and getProviderClient() below refuse to
// hand out a signer at all once this is false, so every one of the 13 call
// sites is covered from a single choke point instead of needing its own
// check. Deliberately a separate, server-only var (no NEXT_PUBLIC_ prefix,
// never reaches the client bundle) rather than reusing the public one --
// defaults to false (fail closed) when unset, so a fresh deployment that
// never sets it doesn't accidentally inherit demo signing. Local dev sets
// this to "true" in .env.local for the same convenience the public flag
// already provides; getFulfillmentOperatorClient() below is intentionally
// NOT gated by this -- it signs auto-fulfill deliveries in production for
// every real purchase, unrelated to the demo-signing fallback entirely.
function requireDemoSigningEnabled(): void {
  if (process.env.ALLOW_DEMO_SIGNING !== "true") {
    throw new Error(
      "[EXPECTED] demo signing is disabled on this deployment -- connect a real wallet to continue"
    );
  }
}

let readClient: ReturnType<typeof createClient> | null = null;
let buyerClient: ReturnType<typeof createClient> | null = null;
let providerClient: ReturnType<typeof createClient> | null = null;

export function getReadClient() {
  if (!readClient) readClient = createClient({ chain: studionet });
  return readClient;
}

export function getBuyerClient() {
  requireDemoSigningEnabled();
  if (!buyerClient) {
    const account = createAccount(requiredEnv("GENLAYER_BUYER_PRIVATE_KEY") as `0x${string}`);
    buyerClient = createClient({ chain: studionet, account });
  }
  return buyerClient;
}

export function getProviderClient() {
  requireDemoSigningEnabled();
  if (!providerClient) {
    const account = createAccount(requiredEnv("GENLAYER_PROVIDER_PRIVATE_KEY") as `0x${string}`);
    providerClient = createClient({ chain: studionet, account });
  }
  return providerClient;
}

export function buyerAddress(): string {
  const account = createAccount(requiredEnv("GENLAYER_BUYER_PRIVATE_KEY") as `0x${string}`);
  return account.address;
}

export function providerAddress(): string {
  const account = createAccount(requiredEnv("GENLAYER_PROVIDER_PRIVATE_KEY") as `0x${string}`);
  return account.address;
}

let fulfillmentOperatorClient: ReturnType<typeof createClient> | null = null;

// The one signer the app itself controls to auto-deliver orders spawned by
// purchase() on behalf of whichever real wallet's listing it was -- see
// submit_delivery()'s auth check in the contract and the constructor arg
// this address was deployed with. Distinct from getBuyerClient()/
// getProviderClient() above: those are a dev-only fallback for signing as
// if no wallet were connected at all; this one is used in production too,
// for every purchase, regardless of whether demo signing is enabled.
export function getFulfillmentOperatorClient() {
  if (!fulfillmentOperatorClient) {
    const account = createAccount(
      requiredEnv("GENLAYER_FULFILLMENT_OPERATOR_PRIVATE_KEY") as `0x${string}`
    );
    fulfillmentOperatorClient = createClient({ chain: studionet, account });
  }
  return fulfillmentOperatorClient;
}

// A transaction reaching FINALIZED status only means consensus agreed on
// the OUTCOME -- validators can unanimously agree that a call reverts, and
// that still finalizes cleanly with no thrown error from
// waitForTransactionReceipt. Confirmed directly against Studio: an
// accept_job call from an unregistered provider finalized with 5/5 AGREE
// while leader_receipt[0].execution_result was "ERROR" and the job's state
// never changed. Every write must check this explicitly or it silently
// reports success on a reverted call.
export async function waitFinalized(client: ReturnType<typeof createClient>, hash: any) {
  const receipt = await withBusyRetry(() =>
    client.waitForTransactionReceipt({
      hash,
      status: "FINALIZED" as any,
      retries: 60,
      interval: 3000,
    })
  );
  const simplified = simplifyTransactionReceipt(receipt) as any;
  const leaderReceipt = simplified?.consensus_data?.leader_receipt?.[0];
  if (leaderReceipt?.execution_result === "ERROR") {
    const message = leaderReceipt?.result?.payload ?? "transaction reverted";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  // The leader's own return value for the exact call this transaction
  // executed -- e.g. create_listing/purchase return their new
  // listing_id/order_id directly (confirmed live: a real create_listing
  // receipt's leader_receipt[0].result was
  // {"status":"return","payload":{"readable":"15"}}, an exact match for
  // that listing's real on-chain id). Reading THIS instead of a follow-up
  // get_*_count() read is what correlates an id to the specific
  // transaction that created it -- a separate count-based read after the
  // fact can race a concurrent creation and silently hand the caller
  // someone else's id instead of its own.
  const returnValue: string | undefined =
    leaderReceipt?.result?.status === "return" ? leaderReceipt.result.payload?.readable : undefined;
  return { receipt, returnValue };
}

// [EXPECTED]-prefixed messages are deterministic contract-level rejections
// (bad state transition, wrong caller, etc.) -- a 400, not a 502. Everything
// else (RPC/network failure, unexpected revert) stays a 502.
export function statusForError(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err);
  return message.startsWith("[EXPECTED]") ? 400 : 502;
}

function shortenAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

function formatCountdown(targetIso: string): string {
  if (!targetIso) return "--";
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return "EXPIRED";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function deadlineFor(raw: RawJob): string {
  switch (raw.state) {
    case "Listed":
    case "Funded":
      return raw.accept_by;
    case "Accepted":
      return raw.deliver_by;
    case "Released":
    case "PartiallyReleased":
    case "Refunded":
      return raw.appeal_deadline;
    default:
      return "";
  }
}

function deriveTitle(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return "Untitled Job";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
}

interface RawClause {
  type: string;
  value: string;
  weight: number;
}

interface RawClauseVerdict {
  index: number;
  verdict: boolean;
  evidence: string;
}

interface RawListing {
  id: number;
  provider: string;
  modality: string;
  description: string;
  clauses: RawClause[];
  price_atto: string | number;
  deliver_window_seconds: string | number;
  appeal_window_seconds: string | number;
  dispute_bond_atto: string | number;
  active: boolean;
  created_at: string;
  requires_input: boolean;
  input_hint: string;
}

export function mapChainListingToUiListing(raw: RawListing): Listing {
  return {
    id: String(raw.id),
    provider: raw.provider,
    providerName: shortenAddress(raw.provider),
    modality: raw.modality as JobModality,
    description: raw.description,
    clauses: raw.clauses,
    priceGen: attoToGen(raw.price_atto),
    deliverWindowSeconds: Number(raw.deliver_window_seconds),
    appealWindowSeconds: Number(raw.appeal_window_seconds),
    disputeBondGen: attoToGen(raw.dispute_bond_atto),
    active: raw.active,
    createdAt: raw.created_at,
    requiresInput: raw.requires_input,
    inputHint: raw.input_hint || undefined,
  };
}

interface RawJob {
  id: number;
  buyer: string;
  provider: string;
  modality: string;
  prompt: string;
  clauses: RawClause[];
  clause_verdicts: RawClauseVerdict[];
  state: string;
  reward_atto: string | number;
  release_fraction_atto: string | number;
  accept_by: string;
  deliver_by: string;
  appeal_deadline: string;
  cid: string;
  dispute_bond_atto: string | number;
  disputant: string;
  created_at: string;
  settled: boolean;
}

// The stored `cid` is a real Pinata-pinned IPFS CID (see lib/pinata.ts's
// pinToIPFS, which uploads to Pinata's "public" network) for every order
// fulfilled through the normal pipeline --
// except a handful of early test orders that used a raw `data:` URI in
// place of a real CID (submit_delivery never validated the shape of what it
// was given). This previously built every gatewayUrl as
// `https://ipfs.io/ipfs/${cid}` unconditionally, which was wrong two ways:
// (1) for a real CID, ipfs.io is a third-party public gateway that has to
// discover the content via DHT/bitswap rather than a domain that's
// guaranteed to actually have it -- gateway.pinata.cloud is where the bytes
// were actually uploaded, so it's what pinToIPFS itself already returns as
// gatewayUrl at delivery time (see autoFulfillOrder), and reads should agree
// with that rather than re-deriving a different, less reliable URL from the
// bare cid; (2) for one of the legacy `data:` "cid" orders, concatenating it
// onto an /ipfs/ path produced a URL that could never resolve at all --
// a data: URI is already a directly usable resource locator on its own and
// should be passed through unchanged, not treated as an IPFS hash.
function gatewayUrlFor(cid: string): string | undefined {
  if (!cid) return undefined;
  if (cid.startsWith("data:")) return cid;
  // Same PINATA_GATEWAY_DOMAIN override lib/pinata.ts's pinToIPFS already
  // respects at upload time -- reads should agree with what was actually
  // returned then, not silently fall back to the shared gateway.pinata.cloud
  // domain, which is unreliable (observed timing out -- "ERR_ID:00016" --
  // even for content genuinely pinned under this account).
  const gatewayDomain = process.env.PINATA_GATEWAY_DOMAIN || "gateway.pinata.cloud";
  return `https://${gatewayDomain}/ipfs/${cid}`;
}

export function mapChainJobToUiJob(raw: RawJob): Job {
  const clauseVerdicts: ClauseVerdict[] | undefined = raw.clause_verdicts?.length
    ? raw.clause_verdicts.map((v) => {
        const clause = raw.clauses[v.index];
        return {
          id: `C${v.index}`,
          label: clause ? `${clause.type.toUpperCase()}: ${clause.value}` : `clause ${v.index}`,
          evidence: v.evidence,
          verdict: v.verdict ? "PASS" : "FAILED_SPEC",
        };
      })
    : undefined;

  return {
    id: String(raw.id),
    title: deriveTitle(raw.prompt),
    modality: raw.modality as JobModality,
    prompt: raw.prompt,
    clauses: raw.clauses.length,
    rewardGen: attoToGen(raw.reward_atto),
    ttl: formatCountdown(deadlineFor(raw)),
    state: raw.state as JobState,
    providerId: raw.provider || undefined,
    providerName: raw.provider ? shortenAddress(raw.provider) : undefined,
    buyerId: raw.buyer,
    releaseFraction: attoToGen(raw.release_fraction_atto),
    clauseVerdicts,
    deadline: deadlineFor(raw) || undefined,
    cid: raw.cid || undefined,
    gatewayUrl: gatewayUrlFor(raw.cid),
    disputeBondGen: attoToGen(raw.dispute_bond_atto),
    settled: raw.settled,
  };
}

export async function readJob(id: number): Promise<Job | null> {
  const client = getReadClient();
  const raw = (await withBusyRetry(() =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_job",
      args: [id],
    })
  )) as unknown as RawJob | Record<string, never>;
  if (!raw || Object.keys(raw).length === 0) return null;
  return mapChainJobToUiJob({ ...(raw as RawJob), id });
}

export async function readAllJobs(): Promise<Job[]> {
  const client = getReadClient();
  const count = Number(
    await withBusyRetry(() =>
      client.readContract({ address: CONTRACT_ADDRESS, functionName: "get_job_count", args: [] })
    )
  );
  // Reading jobs one at a time in a serial loop measured at 60-90s+ for a
  // handful of jobs against Studio -- fetch concurrently instead, but capped:
  // Studio's node has a fixed pool of execution slots (observed error:
  // "Server busy: all 8 execution slots occupied"), and blasting `count`
  // unbounded concurrent reads at it is itself a likely cause of that error,
  // not just something that happens to us from outside load.
  const jobs = await mapWithConcurrency(
    Array.from({ length: count }, (_, i) => i),
    4,
    (i) => readJob(i)
  );
  return jobs.filter((j): j is Job => j !== null).reverse(); // newest first
}

// Registration and accept_job are both free (Studio is gasless, and
// register_provider requires no bond -- confirmed directly in
// contract/contracts/provider_court_escrow.py) while every delivered job
// triggers a real, quota-limited call to the shared Gemini/Cloudflare
// Workers AI/Pinata backend. Nothing on-chain limits how many jobs a single
// wallet can hold in Accepted (accepted-but-undelivered) state at once, so
// that's the only available choke point for a low-effort abuse guard: cap
// how many jobs one provider address may simultaneously be sitting on before
// we'll spend real backend quota generating for another one.
export const MAX_CONCURRENT_ACCEPTED_PER_PROVIDER = 3;

// Bounded variant of readAllJobs() for the two concurrency-abuse checks
// below. Reading every job ever created just to answer "does this address
// have >= MAX_CONCURRENT_ACCEPTED_PER_PROVIDER Accepted jobs right now" gets
// structurally slower forever as job history grows -- measured directly at
// ~10s and climbing, purely from this scan, against real total job counts
// this project's own testing produced (see contract/README.md's timing
// re-measurement). Accepted is a transient state a normal order passes
// through in ~2-4 minutes; the only way one persists is an abandoned/stuck
// order nobody has retried yet, which "Retry automatic fulfillment"
// (orders/[id]) exists specifically to surface and resolve -- so a real
// concurrency violation will always show up among recent activity, and this
// heuristic doesn't need the full history to catch it. Bounded, not
// unbounded-then-capped: cost stays flat as total job count grows, instead
// of growing with it.
const CONCURRENCY_CHECK_LOOKBACK = 20;

async function readRecentJobs(limit: number): Promise<Job[]> {
  const client = getReadClient();
  const count = Number(
    await withBusyRetry(() =>
      client.readContract({ address: CONTRACT_ADDRESS, functionName: "get_job_count", args: [] })
    )
  );
  const start = Math.max(0, count - limit);
  const jobs = await mapWithConcurrency(
    Array.from({ length: count - start }, (_, i) => start + i),
    4,
    (i) => readJob(i)
  );
  return jobs.filter((j): j is Job => j !== null).reverse(); // newest first
}

export async function countConcurrentAccepted(
  providerAddress: string,
  excludeJobId?: number
): Promise<number> {
  const jobs = await readRecentJobs(CONCURRENCY_CHECK_LOOKBACK);
  return jobs.filter(
    (j) =>
      Number(j.id) !== excludeJobId &&
      j.state === "Accepted" &&
      j.providerId?.toLowerCase() === providerAddress.toLowerCase()
  ).length;
}

// purchase() moved the abuse surface: there's no accept_job step anymore,
// so a provider-keyed cap alone no longer gates anything -- a buyer can
// trigger a real generation call the instant their payment confirms, with
// no registered-provider action in between. purchase() does cost the buyer
// the listing's real price, which is itself a natural throttle absent
// before (accepting used to be free), but a listing can still be priced
// arbitrarily low, so the same low-effort concurrency cap is applied here
// too, keyed on the buyer instead of the provider.
export async function countConcurrentAcceptedByBuyer(
  buyerAddress: string,
  excludeJobId?: number
): Promise<number> {
  const jobs = await readRecentJobs(CONCURRENCY_CHECK_LOOKBACK);
  return jobs.filter(
    (j) =>
      Number(j.id) !== excludeJobId &&
      j.state === "Accepted" &&
      j.buyerId?.toLowerCase() === buyerAddress.toLowerCase()
  ).length;
}

export async function readListing(id: number): Promise<Listing | null> {
  const client = getReadClient();
  const raw = (await withBusyRetry(() =>
    client.readContract({ address: CONTRACT_ADDRESS, functionName: "get_listing", args: [id] })
  )) as unknown as RawListing | Record<string, never>;
  if (!raw || Object.keys(raw).length === 0) return null;
  return mapChainListingToUiListing({ ...(raw as RawListing), id });
}

export async function readAllListings(): Promise<Listing[]> {
  const client = getReadClient();
  const count = Number(
    await withBusyRetry(() =>
      client.readContract({ address: CONTRACT_ADDRESS, functionName: "get_listing_count", args: [] })
    )
  );
  const listings = await mapWithConcurrency(
    Array.from({ length: count }, (_, i) => i),
    4,
    (i) => readListing(i)
  );
  return listings.filter((l): l is Listing => l !== null).reverse(); // newest first
}

export async function readOrder(id: number): Promise<Order | null> {
  const client = getReadClient();
  const raw = (await withBusyRetry(() =>
    client.readContract({ address: CONTRACT_ADDRESS, functionName: "get_order", args: [id] })
  )) as unknown as (RawJob & { listing_id: number }) | Record<string, never>;
  if (!raw || Object.keys(raw).length === 0) return null;
  const job = mapChainJobToUiJob({ ...(raw as RawJob), id });
  return { ...job, listingId: Number((raw as any).listing_id) };
}

export async function readAllOrders(): Promise<Order[]> {
  const client = getReadClient();
  const count = Number(
    await withBusyRetry(() =>
      client.readContract({ address: CONTRACT_ADDRESS, functionName: "get_job_count", args: [] })
    )
  );
  const orders = await mapWithConcurrency(
    Array.from({ length: count }, (_, i) => i),
    4,
    (i) => readOrder(i)
  );
  return orders.filter((o): o is Order => o !== null).reverse(); // newest first
}

// The Task 2 core: everything that used to require a provider clicking
// "deliver" now happens automatically the instant a purchase is confirmed.
// Shared by the wallet-signed path (called by the buyer's own browser right
// after purchase() finalizes -- see app/api/chain/orders/[id]/auto-fulfill)
// and the dev-only demo path (called inline right after the demo purchase
// route's own purchase() write), so both paths get identical, always-on
// auto-generation + auto-adjudication -- this must never become
// dispute-only, per the pivot's own non-negotiable.
// Coarse timing log for the real breakdown of "time after payment" --
// separates genuine off-chain generation time, genuine GenVM consensus time
// (the two write+wait steps), and the polling overhead waitFinalized adds on
// top of however long consensus actually took. Plain console.log, not a
// metrics system -- this app has no metrics backend, and the only consumer
// is a human reading server logs to answer exactly that question.
function logStageDuration(orderId: number, stage: string, ms: number): void {
  console.log(`[fulfill-timing] order ${orderId}: ${stage} took ${ms}ms`);
}

export async function autoFulfillOrder(
  orderId: number
): Promise<{ order: Order; cid: string; gatewayUrl?: string }> {
  const totalStart = Date.now();
  const existing = await readJob(orderId);
  if (!existing) throw new Error(`${"[EXPECTED]"} order ${orderId} not found`);

  // This chains three real network operations (generate, a delivery tx, an
  // adjudication tx) -- any of which can time out or fail transiently
  // without the order's on-chain state having actually gotten stuck. If
  // delivery already landed (state moved to Delivered) but adjudication
  // itself didn't complete last time, resume from adjudication instead of
  // re-generating -- the alternative (only ever driving from Accepted)
  // would leave an order that failed partway through with no way to finish
  // automatically at all.
  if (existing.state === "Delivered" && existing.cid) {
    await setFulfillStage(orderId, "consensus");
    const t0 = Date.now();
    const operator = getFulfillmentOperatorClient();
    const adjudicateHash = await operator.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "adjudicate",
      args: [orderId, existing.cid],
      value: 0n,
    });
    await waitFinalized(operator, adjudicateHash as `0x${string}`);
    logStageDuration(orderId, "adjudicate (resumed from Delivered)", Date.now() - t0);
    await clearFulfillStage(orderId);
    const order = await readOrder(orderId);
    if (!order) throw new Error(`order ${orderId} disappeared after fulfillment`);
    return { order, cid: existing.cid! };
  }

  if (existing.state !== "Accepted") {
    throw new Error(`[EXPECTED] order ${orderId} is not in a fulfillable state (currently ${existing.state})`);
  }

  const inFlight = await countConcurrentAcceptedByBuyer(existing.buyerId!, orderId);
  if (inFlight >= MAX_CONCURRENT_ACCEPTED_PER_PROVIDER) {
    throw new Error(
      `[EXPECTED] buyer ${existing.buyerId} already has ${inFlight} other orders awaiting fulfillment (max ${MAX_CONCURRENT_ACCEPTED_PER_PROVIDER})`
    );
  }
  logStageDuration(orderId, "pre-check (readJob + concurrency check, orchestration overhead)", Date.now() - totalStart);

  await setFulfillStage(orderId, "generating");
  let stageStart = Date.now();
  // In-process now (see lib/generate-content.ts) -- no outbound fetch to a
  // second service. A broken/misconfigured service-URL env var used to be
  // able to silently kill this exact step while escrow/adjudication kept
  // working fine; merging removes that whole failure mode.
  const genData = await generateContent(existing.modality, existing.prompt);
  const cid: string = genData.cid;
  logStageDuration(orderId, "generate+pin (in-process)", Date.now() - stageStart);

  await setFulfillStage(orderId, "delivering");
  stageStart = Date.now();
  const operator = getFulfillmentOperatorClient();
  const deliverHash = await operator.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "submit_delivery",
    args: [orderId, cid],
    value: 0n,
  });
  await waitFinalized(operator, deliverHash as `0x${string}`);
  logStageDuration(orderId, "submit_delivery (write+finalize)", Date.now() - stageStart);

  await setFulfillStage(orderId, "consensus");
  stageStart = Date.now();
  const adjudicateHash = await operator.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "adjudicate",
    args: [orderId, cid],
    value: 0n,
  });
  await waitFinalized(operator, adjudicateHash as `0x${string}`);
  logStageDuration(orderId, "adjudicate (write+finalize, real GenVM consensus)", Date.now() - stageStart);
  await clearFulfillStage(orderId);

  const order = await readOrder(orderId);
  if (!order) throw new Error(`order ${orderId} disappeared after fulfillment`);
  logStageDuration(orderId, "TOTAL autoFulfillOrder (all stages + orchestration)", Date.now() - totalStart);
  return { order, cid, gatewayUrl: genData.gatewayUrl };
}

interface RawProviderInfo {
  modalities: string[];
  registered_at: string;
}

export async function readProvider(address: string): Promise<Provider | null> {
  const client = getReadClient();
  const raw = (await withBusyRetry(() =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_provider",
      args: [address],
    })
  )) as unknown as RawProviderInfo | Record<string, never>;
  if (!raw || Object.keys(raw).length === 0) return null;

  const jobs = await readAllJobs();
  const providerJobs = jobs.filter((j) => j.providerId?.toLowerCase() === address.toLowerCase());
  const settledJobs = providerJobs.filter((j) =>
    ["Released", "PartiallyReleased", "Refunded"].includes(j.state)
  );
  const fullReleases = settledJobs.filter((j) => j.state === "Released");
  const fractions = settledJobs.map((j) => j.releaseFraction ?? 0);
  const avgReleaseFraction = fractions.length
    ? fractions.reduce((a, b) => a + b, 0) / fractions.length
    : 0;
  const activeJobs = providerJobs.filter((j) => ["Accepted", "Delivered", "Adjudicating"].includes(j.state));

  const MODALITY_META: Record<string, { icon: string; label: string; detail: string }> = {
    TEXT: { icon: "description", label: "TEXT_LLM", detail: "Text generation via Gemini" },
    IMAGE: { icon: "image", label: "IMAGE_GEN", detail: "Image generation via Cloudflare Workers AI" },
    AUDIO: { icon: "graphic_eq", label: "AUDIO_SYNTH", detail: "Audio synthesis via Cloudflare Workers AI" },
  };

  return {
    id: address,
    name: shortenAddress(address),
    trustScore: settledJobs.length ? Math.round((fullReleases.length / settledJobs.length) * 100) : 100,
    jobsCompleted: settledJobs.length,
    fullReleaseRate: settledJobs.length ? Math.round((fullReleases.length / settledJobs.length) * 100) : 0,
    avgReleaseFraction: Math.round(avgReleaseFraction * 100) / 100,
    activeJobs: activeJobs.length,
    maxCapacity: 5,
    modalities: (raw.modalities ?? []).map((m) => MODALITY_META[m] ?? { icon: "help", label: m, detail: "" }),
    uptime: "N/A (Studio testnet)",
    latency: "N/A (Studio testnet)",
    region: "GenLayer Studio",
  };
}
