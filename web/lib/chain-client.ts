"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Job, Listing, Order, Provider, WalletState } from "./types";
import { genToAtto } from "./atto";
import { getWalletWriteClient, waitFinalizedInBrowser } from "./genlayer-wallet";
import { withBusyRetry } from "./rpc-retry";
import { DEFAULT_APPEAL_WINDOW_SECONDS } from "./constants";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}`;
// See lib/genlayer-wallet.ts / web/.env.local for what this flag means --
// it only matters when no wallet is connected. A real, wallet-connected
// visitor always signs with their own wallet regardless of this flag.
const ALLOW_DEMO_SIGNING = process.env.NEXT_PUBLIC_ALLOW_DEMO_SIGNING === "true";

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? res.statusText);
  return data;
}

// Every read hook below only ever fetches once, on mount -- a settlement,
// purchase, or delivery that completes in another tab (or via this app's own
// auto-fulfill pipeline finishing after the user already navigated away) never
// appears until a manual reload, even on dashboards that visually claim
// "LIVE_SYNC_ENABLED". Refetching when the tab regains focus/visibility is
// the standard fix for exactly this staleness, applied once here so every
// hook below benefits instead of each page inventing its own polling.
//
// This alone caused a real, separate stuck-loading bug: `loading` was set
// back to true on EVERY refetch, including this focus-triggered one -- and
// every page built on these hooks gates its entire render on `loading`
// (`if (loading) return <LoadingState .../>`), so a background refresh on
// refocus was tearing down and remounting the WHOLE page each time,
// including any child component with its own independent fetch lifecycle
// (confirmed directly: this is what left ArtifactViewer's delivered-content
// fetch permanently stuck on tab-switch -- its own effect kept getting
// unmounted mid-flight by the parent page remounting, not its own fetch
// actually hanging). Each hook below now only shows `loading` for the
// genuine first load of a given resource (tracked via a ref, reset when the
// resource identity itself changes) -- a background refresh updates data
// quietly once it arrives, without ever flipping the page back to its
// full loading state.
function useRefetchOnFocus(refetch: () => void) {
  useEffect(() => {
    function onFocusOrVisible() {
      if (document.visibilityState === "visible") refetch();
    }
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);
    return () => {
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [refetch]);
}

function canSignWithWallet(wallet: WalletState): boolean {
  return wallet.status === "connected" && !wallet.wrongNetwork && Boolean(wallet.address);
}

function requireSigningPath(wallet: WalletState): "wallet" | "demo" {
  if (canSignWithWallet(wallet)) return "wallet";
  if (ALLOW_DEMO_SIGNING) return "demo";
  throw new Error("Connect your wallet to continue.");
}

// Called immediately after waitFinalizedInBrowser in every wallet-signed
// write below (accept/deliver/claim/appeal/resolve-appeal) -- a separate
// fetch from that receipt poll, so it can independently hit the same
// transient "Failed to fetch" network blip after a write has already
// genuinely succeeded (see rpc-retry.ts's TRANSIENT_NETWORK_PATTERN doc
// comment for the real order #21 case this was confirmed against). Wrapped
// for the same reason waitFinalizedInBrowser already is: this only re-asks
// for state that already exists on-chain, never re-signs or re-broadcasts.
async function fetchJob(id: string | number): Promise<Job> {
  return withBusyRetry(async () => {
    const res = await fetch(`/api/chain/jobs/${id}`, { cache: "no-store" });
    const data = await jsonOrThrow(res);
    return data.job;
  });
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!hasLoadedOnceRef.current) setLoading(true);
    try {
      const res = await fetch("/api/chain/jobs", { cache: "no-store" });
      const data = await jsonOrThrow(res);
      setJobs(data.jobs);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    refetch();
  }, [refetch]);
  useRefetchOnFocus(refetch);

  return { jobs, loading, error, refetch };
}

export function useJob(id: string | undefined) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!id) return;
    if (!hasLoadedOnceRef.current) setLoading(true);
    try {
      const res = await fetch(`/api/chain/jobs/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setJob(null);
        setError(null);
        return;
      }
      const data = await jsonOrThrow(res);
      setJob(data.job);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    refetch();
  }, [refetch]);
  useRefetchOnFocus(refetch);

  return { job, loading, error, refetch };
}

export function useProvider(address: string | undefined) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!address) return;
    if (!hasLoadedOnceRef.current) setLoading(true);
    try {
      const res = await fetch(`/api/chain/providers/${address}`, { cache: "no-store" });
      if (res.status === 404) {
        setProvider(null);
        setError(null);
        return;
      }
      const data = await jsonOrThrow(res);
      setProvider(data.provider);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    refetch();
  }, [refetch]);
  useRefetchOnFocus(refetch);

  return { provider, loading, error, refetch };
}

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!hasLoadedOnceRef.current) setLoading(true);
    try {
      const res = await fetch("/api/chain/listings", { cache: "no-store" });
      const data = await jsonOrThrow(res);
      setListings(data.listings);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    refetch();
  }, [refetch]);
  useRefetchOnFocus(refetch);

  return { listings, loading, error, refetch };
}

export function useListing(id: string | undefined) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!id) return;
    if (!hasLoadedOnceRef.current) setLoading(true);
    try {
      const res = await fetch(`/api/chain/listings/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setListing(null);
        setError(null);
        return;
      }
      const data = await jsonOrThrow(res);
      setListing(data.listing);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    refetch();
  }, [refetch]);
  useRefetchOnFocus(refetch);

  return { listing, loading, error, refetch };
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!hasLoadedOnceRef.current) setLoading(true);
    try {
      const res = await fetch("/api/chain/orders", { cache: "no-store" });
      const data = await jsonOrThrow(res);
      setOrders(data.orders);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    refetch();
  }, [refetch]);
  useRefetchOnFocus(refetch);

  return { orders, loading, error, refetch };
}

export function useOrder(id: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!id) return;
    if (!hasLoadedOnceRef.current) setLoading(true);
    try {
      const res = await fetch(`/api/chain/orders/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setOrder(null);
        setError(null);
        return;
      }
      const data = await jsonOrThrow(res);
      setOrder(data.order);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    refetch();
  }, [refetch]);
  useRefetchOnFocus(refetch);

  return { order, loading, error, refetch };
}

// Only meaningful for the demo-signing fallback path (no wallet connected) --
// exposes which fixed server-side accounts would sign in that case.
export function useMe() {
  const [me, setMe] = useState<{ buyer: string; provider: string } | null>(null);
  useEffect(() => {
    fetch("/api/chain/me")
      .then((res) => res.json())
      .then(setMe)
      .catch(() => setMe(null));
  }, []);
  return me;
}

export type CreateJobProgress =
  | "awaiting-create-signature"
  | "finalizing-create"
  | "awaiting-fund-signature"
  | "finalizing-fund";

export async function createJob(
  wallet: WalletState,
  payload: {
    modality: "TEXT" | "IMAGE" | "AUDIO";
    prompt: string;
    clauses: { type: string; value: string; weight: number }[];
    rewardGen: number;
    acceptWindowSeconds?: number;
    deliverWindowSeconds?: number;
    appealWindowSeconds?: number;
  },
  onProgress?: (stage: CreateJobProgress) => void
): Promise<{ jobId: number }> {
  if (requireSigningPath(wallet) === "demo") {
    onProgress?.("finalizing-create");
    const res = await fetch("/api/chain/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return jsonOrThrow(res);
  }

  // Real wallet-signed path: buyer's own MetaMask signs both create_job and
  // fund_job, one after another, matching the existing "Confirm & Fund"
  // single-button UX. This is two sequential real GenVM consensus rounds --
  // fund_job needs the job id that only exists after create_job finalizes,
  // so there's a genuine dependency here, not just unnecessary waiting.
  // Real observed latency for this pair has run 10-90s; onProgress exists so
  // the UI can say what's happening instead of leaving the user guessing.
  const client = getWalletWriteClient(wallet.address!);
  const rewardAtto = genToAtto(payload.rewardGen);
  const disputeBondAtto = genToAtto(Math.round(payload.rewardGen * 1.5 * 100) / 100);

  onProgress?.("awaiting-create-signature");
  const createHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "create_job",
    args: [
      payload.modality,
      payload.prompt,
      payload.clauses,
      rewardAtto,
      payload.acceptWindowSeconds ?? 3600,
      payload.deliverWindowSeconds ?? 3600,
      payload.appealWindowSeconds ?? DEFAULT_APPEAL_WINDOW_SECONDS,
      disputeBondAtto,
    ],
    value: 0n,
  });
  onProgress?.("finalizing-create");
  // Reads create_job's own real return value (this transaction's exact
  // job_id) rather than a follow-up get_job_count() read, which can race a
  // concurrent create_job from anyone else and silently hand back the
  // wrong id (see waitFinalizedInBrowser's own doc comment).
  const { returnValue: createReturnValue } = await waitFinalizedInBrowser(client, createHash);
  if (createReturnValue === undefined) {
    throw new Error("create_job finalized but returned no job_id -- cannot correlate");
  }
  const jobId = Number(createReturnValue);

  onProgress?.("awaiting-fund-signature");
  const fundHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "fund_job",
    args: [jobId],
    value: rewardAtto,
  });
  onProgress?.("finalizing-fund");
  await waitFinalizedInBrowser(client, fundHash);

  return { jobId };
}

export async function acceptJob(
  wallet: WalletState,
  id: string,
  onSubmitted?: () => void
): Promise<{ job: Job }> {
  if (requireSigningPath(wallet) === "demo") {
    // The server route may complete its own write even if THIS fetch gets
    // aborted client-side (e.g. a page reload) -- an aborted connection
    // doesn't stop server-side work already in flight. Treat "we sent the
    // request" as "assume submitted" for the same reason as the wallet path
    // below: an ambiguous error here must not be read as "nothing happened."
    onSubmitted?.();
    const res = await fetch(`/api/chain/jobs/${id}/accept`, { method: "POST" });
    return jsonOrThrow(res);
  }

  const client = getWalletWriteClient(wallet.address!);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "accept_job",
    args: [Number(id)],
    value: 0n,
  });
  // A real transaction now exists on-chain regardless of what happens next
  // (a wait-for-finalization error here does NOT mean the tx didn't/won't
  // land) -- the caller uses this to decide whether it's safe to let the
  // user retry, since retrying after this point risks a second real
  // transaction racing the first.
  onSubmitted?.();
  await waitFinalizedInBrowser(client, hash);
  return { job: await fetchJob(id) };
}

// Delivery stays a two-step flow: generation/pinning is a plain API call
// (no signing, no chain interaction -- runs in-process server-side, see
// lib/generate-content.ts), then whichever wallet is connected signs
// submit_delivery with the real returned CID.
export async function deliverJob(
  wallet: WalletState,
  id: string,
  job: Pick<Job, "modality" | "prompt">
): Promise<{ job: Job; cid: string }> {
  if (requireSigningPath(wallet) === "demo") {
    const res = await fetch(`/api/chain/jobs/${id}/deliver`, { method: "POST" });
    return jsonOrThrow(res);
  }

  const genRes = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modality: job.modality, prompt: job.prompt, jobId: id, address: wallet.address }),
  });
  const genData = await jsonOrThrow(genRes);
  const cid: string = genData.cid;

  const client = getWalletWriteClient(wallet.address!);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "submit_delivery",
    args: [Number(id), cid],
    value: 0n,
  });
  await waitFinalizedInBrowser(client, hash);
  return { job: await fetchJob(id), cid };
}

export async function adjudicateJob(wallet: WalletState, id: string, cid: string): Promise<{ job: Job }> {
  if (requireSigningPath(wallet) === "demo") {
    const res = await fetch(`/api/chain/jobs/${id}/adjudicate`, { method: "POST" });
    return jsonOrThrow(res);
  }

  const client = getWalletWriteClient(wallet.address!);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "adjudicate",
    args: [Number(id), cid],
    value: 0n,
  });
  await waitFinalizedInBrowser(client, hash);
  return { job: await fetchJob(id) };
}

export async function appealJob(
  wallet: WalletState,
  id: string,
  disputeBondGen: number
): Promise<{ job: Job }> {
  if (requireSigningPath(wallet) === "demo") {
    const res = await fetch(`/api/chain/jobs/${id}/appeal`, { method: "POST" });
    return jsonOrThrow(res);
  }

  const client = getWalletWriteClient(wallet.address!);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "appeal",
    args: [Number(id)],
    value: genToAtto(disputeBondGen),
  });
  await waitFinalizedInBrowser(client, hash);
  return { job: await fetchJob(id) };
}

export async function resolveAppeal(wallet: WalletState, id: string, cid: string): Promise<{ job: Job }> {
  if (requireSigningPath(wallet) === "demo") {
    const res = await fetch(`/api/chain/jobs/${id}/resolve-appeal`, { method: "POST" });
    return jsonOrThrow(res);
  }

  const client = getWalletWriteClient(wallet.address!);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "resolve_appeal",
    args: [Number(id), cid],
    value: 0n,
  });
  await waitFinalizedInBrowser(client, hash);
  return { job: await fetchJob(id) };
}

// Same repeat-submission risk as acceptJob (see its own doc comment): a
// real transaction can be sent and then error out for US (network hiccup,
// our own wait timing out) without that meaning claim_settlement itself
// reverted -- releasing a UI lock on the error alone is what let a second
// real transaction race the first there, and the same pattern applies here.
// onSubmitted fires the instant a real transaction has actually been sent
// (or, for the demo path, the instant the request that will trigger one is
// sent), so the caller can tell "nothing happened yet" apart from "may have
// already happened" and drive its lock/confirmation logic accordingly (see
// orders/[id]/verdict/page.tsx's handleRelease, mirroring jobs/[id]/page.tsx's
// handleAccept).
export async function claimSettlement(
  wallet: WalletState,
  id: string,
  onSubmitted?: () => void
): Promise<{ job: Job }> {
  if (requireSigningPath(wallet) === "demo") {
    onSubmitted?.();
    const res = await fetch(`/api/chain/jobs/${id}/claim`, { method: "POST" });
    return jsonOrThrow(res);
  }

  const client = getWalletWriteClient(wallet.address!);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "claim_settlement",
    args: [Number(id)],
    value: 0n,
  });
  onSubmitted?.();
  await waitFinalizedInBrowser(client, hash);
  return { job: await fetchJob(id) };
}

export async function registerProvider(
  wallet: WalletState,
  modalities: ("TEXT" | "IMAGE" | "AUDIO")[]
): Promise<{ address: string }> {
  if (requireSigningPath(wallet) === "demo") {
    const res = await fetch("/api/chain/providers/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modalities }),
    });
    return jsonOrThrow(res);
  }

  const client = getWalletWriteClient(wallet.address!);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "register_provider",
    args: [modalities],
    value: 0n,
  });
  await waitFinalizedInBrowser(client, hash);
  return { address: wallet.address! };
}

// register_provider is create-only (rejects if the wallet is already
// registered, regardless of which modality is requested) -- this is the
// separate path for a wallet that's already registered to expand what it
// offers later (e.g. started with IMAGE, now wants to also offer TEXT).
// One on-chain call per modality, matching add_modality's single-modality
// signature.
export async function addProviderModality(
  wallet: WalletState,
  modality: "TEXT" | "IMAGE" | "AUDIO"
): Promise<{ address: string }> {
  if (requireSigningPath(wallet) === "demo") {
    const res = await fetch("/api/chain/providers/add-modality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modality }),
    });
    return jsonOrThrow(res);
  }

  const client = getWalletWriteClient(wallet.address!);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "add_modality",
    args: [modality],
    value: 0n,
  });
  await waitFinalizedInBrowser(client, hash);
  return { address: wallet.address! };
}

// --- Provider-listed services (Section: pivot to listings + purchase) ---

export interface DerivedClause {
  type: string;
  value: string;
  weight: number;
  // Index signature so this satisfies genlayer-js's CalldataEncodable
  // constraint when passed directly as a writeContract arg (matches the
  // same shape create_listing's clauses arg always used before this).
  [key: string]: string | number;
}

// Clause authoring is gone from the UI -- this is what replaces it. Never
// throws: a network hiccup or an LLM failure falls back to a generic
// must_mention clause (guaranteeFallback=true, used for a listing's own
// content clauses, which the contract requires to be non-empty) or to no
// clause at all (guaranteeFallback=false, used for buyer-input clauses,
// which are purely additive and fine to skip). See lib/derive-clauses.ts
// for the actual derivation.
export async function deriveClauses(
  modality: "TEXT" | "IMAGE" | "AUDIO",
  text: string,
  maxClauses: number,
  options: { guaranteeFallback?: boolean; context?: string; forceWeight?: number } = {}
): Promise<DerivedClause[]> {
  const { guaranteeFallback = false, context, forceWeight } = options;
  const trimmed = text.trim();
  if (!trimmed) {
    return guaranteeFallback ? [{ type: "must_mention", value: modality, weight: forceWeight ?? 2 }] : [];
  }
  try {
    const res = await fetch("/api/derive-clauses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modality, text: trimmed, maxClauses, guaranteeFallback, context, forceWeight }),
    });
    const data = await jsonOrThrow(res);
    return data.clauses ?? [];
  } catch (err) {
    console.error("deriveClauses failed, falling back:", (err as Error).message);
    return guaranteeFallback
      ? [{ type: "must_mention", value: trimmed.slice(0, 200), weight: forceWeight ?? 2 }]
      : [];
  }
}

export type CreateListingProgress = "awaiting-listing-signature" | "finalizing-listing";

export async function createListing(
  wallet: WalletState,
  payload: {
    modality: "TEXT" | "IMAGE" | "AUDIO";
    description: string;
    contentClauses: DerivedClause[];
    priceGen: number;
    deliverWindowSeconds?: number;
    appealWindowSeconds?: number;
    disputeBondGen?: number;
    requiresInput?: boolean;
    inputHint?: string;
  },
  onProgress?: (stage: CreateListingProgress) => void
): Promise<{ listingId: number }> {
  if (requireSigningPath(wallet) === "demo") {
    onProgress?.("finalizing-listing");
    const res = await fetch("/api/chain/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return jsonOrThrow(res);
  }

  const client = getWalletWriteClient(wallet.address!);
  const priceAtto = genToAtto(payload.priceGen);
  const disputeBondAtto = genToAtto(payload.disputeBondGen ?? Math.round(payload.priceGen * 1.5 * 100) / 100);

  onProgress?.("awaiting-listing-signature");
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "create_listing",
    args: [
      payload.modality,
      payload.description,
      payload.contentClauses,
      priceAtto,
      payload.deliverWindowSeconds ?? 3600,
      payload.appealWindowSeconds ?? DEFAULT_APPEAL_WINDOW_SECONDS,
      disputeBondAtto,
      payload.requiresInput ?? false,
      payload.inputHint ?? "",
    ],
    value: 0n,
  });
  onProgress?.("finalizing-listing");
  // Reads create_listing's own real return value (this transaction's exact
  // listing_id) rather than a follow-up get_listing_count() read, which
  // can race a concurrent create_listing from anyone else and silently
  // hand back the wrong id (see waitFinalizedInBrowser's own doc comment).
  const { returnValue } = await waitFinalizedInBrowser(client, hash);
  if (returnValue === undefined) {
    throw new Error("create_listing finalized but returned no listing_id -- cannot correlate");
  }
  return { listingId: Number(returnValue) };
}

export async function deactivateListing(wallet: WalletState, listingId: string): Promise<{ listing: Listing }> {
  if (requireSigningPath(wallet) === "demo") {
    const res = await fetch(`/api/chain/listings/${listingId}/deactivate`, { method: "POST" });
    return jsonOrThrow(res);
  }

  const client = getWalletWriteClient(wallet.address!);
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "set_listing_active",
    args: [Number(listingId), false],
    value: 0n,
  });
  await waitFinalizedInBrowser(client, hash);
  const res = await fetch(`/api/chain/listings/${listingId}`, { cache: "no-store" });
  const data = await jsonOrThrow(res);
  return { listing: data.listing };
}

// Payment succeeding IS the claim -- there is no separate accept step.
// onProgress reports "auto-generating" for the stretch after the purchase
// itself has already finalized on-chain, while the app's own
// fulfillment-operator key generates, pins, delivers, and adjudicates
// automatically server-side (see /api/chain/orders/[id]/auto-fulfill) --
// no second wallet prompt happens during that stretch, by design.
export type PurchaseProgress = "awaiting-purchase-signature" | "finalizing-purchase" | "auto-generating";
// orderId is only ever passed alongside "auto-generating" -- that's the
// first point it's actually known (right after purchase() finalizes, before
// the auto-fulfill call that follows it). The caller uses it to poll real
// pipeline-stage progress (see components/PipelineProgress.tsx) instead of
// showing one static "generating..." message for the whole stretch.

// Once the purchase transaction itself has finalized on-chain, payment has
// already succeeded -- a failure in the auto-generate/deliver/adjudicate
// pipeline from this point on is a genuine post-payment fulfillment failure,
// not a purchase failure, and must never be reported the same way (throwing
// here would lose the orderId and strand the buyer with a paid order they
// have no way to find). Both paths below therefore always return an
// orderId once purchase() has finalized, with fulfillError set instead of
// throwing if the automatic pipeline didn't complete -- the order detail
// page's own "Retry automatic fulfillment" picks up from wherever the
// order's on-chain state actually is.
export async function purchaseListing(
  wallet: WalletState,
  listingId: string,
  priceGen: number,
  buyerInput: string,
  modality: "TEXT" | "IMAGE" | "AUDIO",
  listingDescription: string,
  onProgress?: (stage: PurchaseProgress, orderId?: number) => void
): Promise<{ orderId: number; order: Order; fulfillError?: string }> {
  // Buyer input still shapes the generation prompt exactly as before (see
  // the contract's _combine_prompt) AND now also becomes a real clause the
  // buyer's specific request actually gets checked against at adjudication
  // -- not just text appended to the prompt. Derived once here, up front,
  // so both signing paths below use the identical result; failure here
  // just means no extra clause gets added (buyer_clauses is optional), it
  // never blocks the purchase itself.
  //
  // The listing's own description is passed as background context (never
  // derived from directly) so the buyer clause is coherent with what kind
  // of deliverable this actually is, and forceWeight:3 makes the buyer's
  // own specific request dominate the release-fraction math over the
  // listing's own generic, immutable-per-listing content clauses -- a
  // buyer-specific ask should not get diluted by a generic listing clause
  // that has nothing to do with what they actually asked for.
  const buyerClauses = await deriveClauses(modality, buyerInput, 1, {
    guaranteeFallback: false,
    context: listingDescription,
    forceWeight: 3,
  });

  if (requireSigningPath(wallet) === "demo") {
    onProgress?.("finalizing-purchase");
    const res = await fetch(`/api/chain/listings/${listingId}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerInput, buyerClauses }),
    });
    const data = await jsonOrThrow(res);
    return { orderId: data.orderId, order: data.order, fulfillError: data.fulfillError };
  }

  const client = getWalletWriteClient(wallet.address!);
  const priceAtto = genToAtto(priceGen);

  onProgress?.("awaiting-purchase-signature");
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "purchase",
    args: [Number(listingId), buyerInput, buyerClauses],
    value: priceAtto,
  });
  onProgress?.("finalizing-purchase");
  // Reads purchase's own real return value (this transaction's exact
  // order_id) rather than a follow-up get_job_count() read, which can race
  // a concurrent purchase from anyone else and silently hand back someone
  // else's order id (see waitFinalizedInBrowser's own doc comment).
  const { returnValue } = await waitFinalizedInBrowser(client, hash);
  if (returnValue === undefined) {
    throw new Error("purchase finalized but returned no order_id -- cannot correlate");
  }
  const orderId = Number(returnValue);

  onProgress?.("auto-generating", orderId);
  try {
    const fulfillRes = await fetch(`/api/chain/orders/${orderId}/auto-fulfill`, { method: "POST" });
    const fulfillData = await jsonOrThrow(fulfillRes);
    return { orderId, order: fulfillData.order };
  } catch (err) {
    const orderRes = await fetch(`/api/chain/orders/${orderId}`, { cache: "no-store" });
    const orderData = await jsonOrThrow(orderRes);
    return { orderId, order: orderData.order, fulfillError: (err as Error).message };
  }
}
