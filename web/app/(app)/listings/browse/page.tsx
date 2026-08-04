"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PipelineProgress } from "@/components/PipelineProgress";
import { PurchaseProgress, purchaseListing, useListings } from "@/lib/chain-client";
import { useAppState } from "@/lib/store";
import { acquireLock, isLocked, releaseLock } from "@/lib/tx-lock";
import { JobModality } from "@/lib/types";
import { formatGen } from "@/lib/format";

const MODALITY_ICON: Record<JobModality, string> = {
  TEXT: "description",
  IMAGE: "image",
  AUDIO: "graphic_eq",
};

const MODALITY_COLOR: Record<JobModality, string> = {
  TEXT: "text-primary",
  IMAGE: "text-secondary",
  AUDIO: "text-tertiary",
};

const PROGRESS_LABEL: Record<PurchaseProgress, string> = {
  "awaiting-purchase-signature": "Waiting for you to confirm payment in your wallet...",
  "finalizing-purchase": "Payment submitted -- waiting for GenVM consensus to finalize (typically 10-60s)...",
  "auto-generating": "Payment confirmed. Automatically fulfilling this order:",
};

// Replaces the old open-jobs Browse+Accept flow: buyers no longer accept an
// open job then wait for a provider to deliver -- they buy an already-listed
// service outright, one wallet confirmation, and the rest (generation,
// pinning, delivery, adjudication) happens automatically.
export default function BrowseListingsPage() {
  const router = useRouter();
  const { wallet } = useAppState();
  const { listings, loading, error } = useListings();
  const [filter, setFilter] = useState<"ALL" | JobModality>("ALL");
  const [buying, setBuying] = useState<string | null>(null);
  const [confirmListingId, setConfirmListingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<PurchaseProgress | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [buyerInput, setBuyerInput] = useState("");
  // Tracks the exact input that just failed, so re-clicking Pay with the
  // same unchanged input (which would just fail the same way again) stays
  // blocked until the buyer actually changes something -- see Task 3: a
  // shown error must actually gate Pay, not just be informational.
  const [failedInput, setFailedInput] = useState<string | null>(null);

  const active = useMemo(() => listings.filter((l) => l.active), [listings]);
  const filtered = useMemo(
    () => (filter === "ALL" ? active : active.filter((l) => l.modality === filter)),
    [active, filter]
  );

  const confirmListing = confirmListingId ? listings.find((l) => l.id === confirmListingId) : null;

  // Buyer input is always optional, for every listing, regardless of
  // requiresInput -- that flag only changes the hint text shown below, it
  // never gates Pay. The one thing that still gates Pay is resubmitting the
  // exact same input that just failed (see Task 3 from the buyer-input work).
  const knownToFail = purchaseError !== null && failedInput !== null && buyerInput === failedInput;
  const payBlocked = knownToFail;

  function openConfirm(listingId: string) {
    setConfirmListingId(listingId);
    setPurchaseError(null);
    setFailedInput(null);
    setBuyerInput("");
  }

  async function handleBuyNow() {
    if (!confirmListing || payBlocked) return;
    const id = confirmListing.id;
    if (isLocked(id, "purchase")) {
      setPurchaseError("A purchase for this listing is already in progress -- please wait for it to finalize.");
      return;
    }
    acquireLock(id, "purchase");
    setBuying(id);
    setPurchaseError(null);
    setProgress(null);
    setPendingOrderId(null);
    try {
      const { orderId, fulfillError } = await purchaseListing(
        wallet,
        id,
        confirmListing.priceGen,
        buyerInput.trim(),
        confirmListing.modality,
        confirmListing.description,
        (stage, orderIdForStage) => {
          setProgress(stage);
          if (orderIdForStage !== undefined) setPendingOrderId(orderIdForStage);
        }
      );
      releaseLock(id, "purchase");
      // Payment already succeeded on-chain at this point regardless of
      // fulfillError -- always land the buyer on their order (which has its
      // own retry path) rather than stranding them on this page with just
      // an error and no way to find what they paid for (Task 4).
      const query = fulfillError ? `?fulfillError=${encodeURIComponent(fulfillError)}` : "";
      router.push(`/orders/${orderId}${query}`);
    } catch (err) {
      setPurchaseError((err as Error).message);
      setFailedInput(buyerInput);
      releaseLock(id, "purchase");
    } finally {
      setBuying(null);
      setProgress(null);
      setPendingOrderId(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-64 shrink-0 border-r border-outline dark:border-outline-variant bg-surface-container-low flex-col py-6">
        <div className="px-6 mb-8">
          <h3 className="font-mono-label text-mono-label text-primary uppercase mb-2">
            [01] STATUS: OPERATIONAL
          </h3>
          <p className="font-mono-data text-mono-data opacity-60">Network: GenLayer Studio</p>
          <div className="mt-4 p-2 machine-border text-center bg-primary-container/10 font-mono-label text-mono-label">
            Role: Buyer
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <div className="px-4 mb-4">
            <span className="font-mono-label text-[10px] text-outline uppercase tracking-widest">
              Listing Modality
            </span>
          </div>
          {(
            [
              { key: "ALL", label: "All Listings", icon: "storefront" },
              { key: "TEXT", label: "[TEXT]", icon: "text_fields" },
              { key: "IMAGE", label: "[IMAGE]", icon: "image" },
              { key: "AUDIO", label: "[AUDIO]", icon: "graphic_eq" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                "w-full flex items-center gap-3 px-6 py-3 transition-all " +
                (filter === f.key
                  ? "bg-primary text-on-primary font-bold border-l-4 border-primary"
                  : "text-on-surface-variant hover:bg-surface-variant")
              }
            >
              <span className="material-symbols-outlined">{f.icon}</span>
              <span className="font-mono-label">{f.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Desktop grid */}
      <main className="hidden md:block flex-1 px-margin-desktop py-12">
        {loading && (
          <div className="mb-8">
            <LoadingState label="Reading live listings from GenLayer Studio..." />
          </div>
        )}
        {error && (
          <div className="mb-8">
            <ErrorBanner message={error} />
          </div>
        )}
        <div className="mb-12 border-b border-black pb-8 flex justify-between items-end">
          <div>
            <h1 className="font-display-lg text-display-lg uppercase leading-none mb-2">
              Browse
              <br />
              Listed Services
            </h1>
            <p className="font-mono-label text-mono-label text-on-surface-variant max-w-xl">
              [MARKETPLACE] Ready-made services from registered providers. Buy now -- generation, delivery,
              and adjudication all happen automatically.
            </p>
          </div>
          <span className="font-headline-lg text-headline-lg font-black opacity-10">[01]</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
          {filtered.map((listing, i) => (
            <div
              key={listing.id}
              className="machine-border flex flex-col transition-colors group bg-surface hover:bg-surface-bright"
            >
              <div className="p-technical-gap border-b border-black flex justify-between items-center bg-surface-container">
                <span
                  className={
                    "font-mono-label text-mono-label font-bold flex items-center gap-1.5 " +
                    MODALITY_COLOR[listing.modality]
                  }
                >
                  <span className="material-symbols-outlined text-[18px]">{MODALITY_ICON[listing.modality]}</span>
                  [{String(i + 1).padStart(2, "0")}] {listing.modality}
                </span>
                <span className="font-mono-data text-mono-data text-outline">ID: {listing.id}</span>
              </div>
              <div className="p-6 flex-1">
                {listing.modality === "AUDIO" && (
                  <p className="font-mono-data text-[10px] text-tertiary uppercase mb-2">
                    [text-to-speech only -- spoken voice, not music/song]
                  </p>
                )}
                <p className="font-body-md text-body-md mb-2 line-clamp-3">{listing.description}</p>
                <p className="font-mono-data text-mono-data text-on-surface-variant mb-4">
                  by {listing.providerName}
                </p>
                {listing.requiresInput && (
                  <p className="font-mono-data text-[10px] text-primary uppercase mb-2">
                    [suggests input] {listing.inputHint || "you'll describe what you want at checkout"}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 border-t border-black/10 pt-4">
                  <div className="text-center">
                    <span className="block font-mono-data text-mono-data uppercase text-outline">Clauses</span>
                    <span className="font-mono-label text-mono-label">{listing.clauses.length}</span>
                  </div>
                  <div className="text-center">
                    <span className="block font-mono-data text-mono-data uppercase text-outline">Price</span>
                    <span className="font-mono-label text-mono-label">{formatGen(listing.priceGen)} GEN</span>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-black">
                <button
                  onClick={() => openConfirm(listing.id)}
                  disabled={buying === listing.id || isLocked(listing.id, "purchase")}
                  className="w-full py-3 font-mono-label text-mono-label transition-all flex justify-center items-center gap-2 group-active:scale-95 disabled:opacity-50 bg-primary text-on-primary hover:invert"
                >
                  {buying === listing.id || isLocked(listing.id, "purchase")
                    ? "Processing purchase..."
                    : `Buy Now -- ${formatGen(listing.priceGen)} GEN`}
                  <span className="material-symbols-outlined text-sm">shopping_cart</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Mobile list */}
      <main className="md:hidden flex-1 px-4">
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex justify-between items-end">
            <h1 className="font-headline-md text-headline-lg-mobile text-on-surface uppercase">
              [01] BROWSE LISTINGS
            </h1>
            <span className="font-mono-data text-mono-data text-outline">NETWORK_STATUS: OK</span>
          </div>
          {loading && <LoadingState label="Reading live listings from GenLayer Studio..." />}
          {error && <ErrorBanner message={error} />}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(["ALL", "TEXT", "IMAGE", "AUDIO"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setFilter(m)}
                className={
                  "px-3 py-1 font-mono-label text-mono-label border transition-colors whitespace-nowrap " +
                  (filter === m
                    ? "bg-primary text-on-primary border-primary"
                    : "bg-surface-container text-on-surface-variant border-outline hover:bg-surface-container-high")
                }
              >
                {m === "ALL" ? "ALL_MODALITIES" : m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 pb-8">
          {filtered.map((listing) => (
            <article key={listing.id} className="bg-surface border border-outline flex flex-col">
              <div className="bg-surface-container-low px-3 py-2 flex justify-between items-center border-b border-outline">
                <div className="flex items-center gap-2">
                  <span className={"material-symbols-outlined text-lg " + MODALITY_COLOR[listing.modality]}>
                    {MODALITY_ICON[listing.modality]}
                  </span>
                  <span className="font-mono-label text-mono-label uppercase">
                    [MODALITY: {listing.modality}]
                  </span>
                </div>
                <span className="font-mono-data text-mono-data text-outline">ID: {listing.id}</span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {listing.modality === "AUDIO" && (
                  <p className="font-mono-data text-[10px] text-tertiary uppercase">
                    [text-to-speech only -- spoken voice, not music/song]
                  </p>
                )}
                <p className="font-mono-data text-mono-data text-on-surface-variant leading-relaxed">
                  {listing.description}
                </p>
                {listing.requiresInput && (
                  <p className="font-mono-data text-[10px] text-primary uppercase">
                    [suggests input] {listing.inputHint || "you'll describe what you want at checkout"}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="flex flex-col">
                    <span className="font-mono-data text-mono-data text-outline text-[10px] uppercase">
                      Price
                    </span>
                    <span className="font-mono-label text-body-md text-primary font-bold">
                      {formatGen(listing.priceGen)} GEN
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono-data text-mono-data text-outline text-[10px] uppercase">
                      Provider
                    </span>
                    <span className="font-mono-label text-body-md text-on-surface">
                      {listing.providerName}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => openConfirm(listing.id)}
                disabled={buying === listing.id || isLocked(listing.id, "purchase")}
                className="w-full bg-primary text-on-primary font-mono-label py-3 text-center transition-opacity active:opacity-90 uppercase disabled:opacity-50"
              >
                {buying === listing.id || isLocked(listing.id, "purchase")
                  ? "Processing purchase..."
                  : "Buy Now"}
              </button>
            </article>
          ))}
        </div>
      </main>

      <Modal
        open={Boolean(confirmListing)}
        onClose={() => (buying ? null : setConfirmListingId(null))}
        tag="[BUY]"
        title="CONFIRM_PURCHASE"
        footer={
          <>
            <button
              onClick={() => setConfirmListingId(null)}
              disabled={Boolean(buying)}
              className="px-6 py-3 border border-outline font-mono-label text-mono-label hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              CANCEL
            </button>
            <button
              onClick={handleBuyNow}
              disabled={Boolean(buying) || payBlocked}
              className="px-6 py-3 bg-primary text-on-primary font-mono-label text-mono-label hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {buying ? "PROCESSING..." : `PAY ${formatGen(confirmListing?.priceGen ?? 0)} GEN`}
            </button>
          </>
        }
      >
        {confirmListing && (
          <div className="space-y-2 font-mono-data text-mono-data">
            <div className="flex justify-between border-b border-outline-variant py-2">
              <span className="text-on-surface-variant">DESCRIPTION</span>
              <span>{confirmListing.description}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant py-2">
              <span className="text-on-surface-variant">MODALITY</span>
              <span>{confirmListing.modality}</span>
            </div>
            {confirmListing.modality === "AUDIO" && (
              <p className="font-mono-data text-[11px] text-tertiary py-1">
                [NOTE] Delivered as spoken text-to-speech audio only -- this cannot produce
                music, songs, or melodies, regardless of what's requested below.
              </p>
            )}
            <div className="flex justify-between py-2 text-primary font-bold">
              <span>PRICE</span>
              <span>{formatGen(confirmListing.priceGen)} GEN</span>
            </div>
            {/* Always available, for every listing -- requiresInput only changes
                the hint text here, it never decides whether this field exists.
                Leaving it blank falls back to the listing's own description,
                exactly as before; typing something always gets combined in. */}
            <div className="pt-2">
              <label className="flex flex-col gap-1">
                <span className="font-mono-label text-[11px] text-on-surface-variant opacity-70">
                  {confirmListing.requiresInput
                    ? `This listing suggests adding: ${confirmListing.inputHint || "more detail"}`
                    : "Add detail to customize this order (optional)"}
                </span>
                <textarea
                  value={buyerInput}
                  onChange={(e) => setBuyerInput(e.target.value)}
                  placeholder={
                    confirmListing.requiresInput
                      ? confirmListing.inputHint || "Describe what you want..."
                      : "Optional -- leave blank to use the listing's description as-is"
                  }
                  rows={3}
                  className="bg-surface border border-outline p-2 font-mono-data text-sm focus:border-primary outline-none resize-none"
                />
              </label>
            </div>
          </div>
        )}
        {progress && (
          <p className="font-mono-data text-mono-data text-primary mt-4 leading-relaxed">
            {PROGRESS_LABEL[progress]}
          </p>
        )}
        {progress === "auto-generating" && pendingOrderId !== null && (
          <div className="mt-3 border border-outline-variant bg-surface-container-low p-4">
            <PipelineProgress orderId={pendingOrderId} active={true} />
          </div>
        )}
        {knownToFail && !progress && (
          <p className="font-mono-data text-mono-data text-error mt-4">
            [BLOCKED] This exact input already failed below -- change it before trying again.
          </p>
        )}
        {purchaseError && (
          <p className="font-mono-data text-mono-data text-error mt-4">[ERROR] {purchaseError}</p>
        )}
      </Modal>
    </div>
  );
}
