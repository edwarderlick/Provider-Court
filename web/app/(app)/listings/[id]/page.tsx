"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { InlineSpinner } from "@/components/InlineSpinner";
import { PurchaseProgress, deactivateListing, purchaseListing, useListing } from "@/lib/chain-client";
import { useAppState } from "@/lib/store";
import { acquireLock, isLocked, releaseLock } from "@/lib/tx-lock";
import { formatGen } from "@/lib/format";

const PROGRESS_LABEL: Record<PurchaseProgress, string> = {
  "awaiting-purchase-signature": "Waiting for you to confirm payment in your wallet...",
  "finalizing-purchase": "Payment submitted -- waiting for GenVM consensus to finalize (typically 10-60s)...",
  "auto-generating":
    "Payment confirmed. Generating, pinning, delivering, and adjudicating automatically -- this can take a couple of minutes.",
};

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { wallet } = useAppState();
  const { listing, loading, error, refetch } = useListing(params.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [progress, setProgress] = useState<PurchaseProgress | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivateLocked, setDeactivateLocked] = useState(false);
  const [buyerInput, setBuyerInput] = useState("");
  const [failedInput, setFailedInput] = useState<string | null>(null);

  const isOwner = Boolean(
    wallet.address && listing && wallet.address.toLowerCase() === listing.provider.toLowerCase()
  );

  // Buyer input is always optional, for every listing, regardless of
  // requiresInput -- that flag only changes the hint text below, it never
  // gates Pay. The one thing that still gates Pay is resubmitting the exact
  // same input that just failed (see Task 3 from the buyer-input work).
  const knownToFail = purchaseError !== null && failedInput !== null && buyerInput === failedInput;
  const payBlocked = knownToFail;

  useEffect(() => {
    setDeactivateLocked(isLocked(params.id, "deactivate"));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <LoadingState fullPage label={`Reading listing #${params.id} from GenLayer Studio...`} />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 py-32">
        {error ? (
          <ErrorBanner message={error} />
        ) : (
          <p className="font-mono-label text-mono-label text-on-surface-variant">
            [404] LISTING_ID "{params.id}" NOT FOUND ON-CHAIN
          </p>
        )}
        <Link href="/listings/browse" className="text-primary underline font-mono-label text-mono-label">
          Return to Browse Listings
        </Link>
      </div>
    );
  }

  async function handleBuyNow() {
    if (payBlocked) return;
    if (isLocked(listing!.id, "purchase")) {
      setPurchaseError("A purchase for this listing is already in progress -- please wait for it to finalize.");
      return;
    }
    acquireLock(listing!.id, "purchase");
    setBuying(true);
    setPurchaseError(null);
    setProgress(null);
    try {
      const { orderId, fulfillError } = await purchaseListing(
        wallet,
        listing!.id,
        listing!.priceGen,
        buyerInput.trim(),
        listing!.modality,
        listing!.description,
        setProgress
      );
      releaseLock(listing!.id, "purchase");
      const query = fulfillError ? `?fulfillError=${encodeURIComponent(fulfillError)}` : "";
      router.push(`/orders/${orderId}${query}`);
    } catch (err) {
      setPurchaseError((err as Error).message);
      setFailedInput(buyerInput);
      releaseLock(listing!.id, "purchase");
    } finally {
      setBuying(false);
      setProgress(null);
    }
  }

  async function handleDeactivate() {
    if (isLocked(listing!.id, "deactivate")) {
      setDeactivateError("A deactivation for this listing is already in progress -- please wait for it to finalize.");
      return;
    }
    acquireLock(listing!.id, "deactivate");
    setDeactivateLocked(true);
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await deactivateListing(wallet, listing!.id);
      await refetch();
    } catch (err) {
      setDeactivateError((err as Error).message);
    } finally {
      releaseLock(listing!.id, "deactivate");
      setDeactivateLocked(false);
      setDeactivating(false);
    }
  }

  return (
    <div className="bg-technical-grid flex-1 px-margin-mobile md:px-margin-desktop py-margin-desktop">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-outline pb-6">
          <div>
            <span
              className={
                "px-2 py-1 font-mono-data text-mono-data font-bold " +
                (listing.active
                  ? "bg-secondary text-on-secondary"
                  : "bg-surface-dim text-on-surface-variant")
              }
            >
              STATUS: {listing.active ? "ACTIVE" : "INACTIVE"}
            </span>
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase tracking-tight mt-2">
              Listing #{listing.id}
            </h2>
            <p className="font-mono-label text-mono-label text-on-surface-variant mt-1">
              by{" "}
              <Link href={`/providers/${listing.provider}`} className="text-primary underline">
                {listing.providerName}
              </Link>
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono-data text-mono-data text-on-surface-variant block">
              MODALITY: {listing.modality}
            </span>
            <span className="font-mono-data text-mono-data text-primary font-bold">
              {formatGen(listing.priceGen)} GEN / ORDER
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-8 bg-surface border border-outline p-6">
            <h3 className="font-mono-label text-mono-label font-bold text-primary mb-4">[01] DESCRIPTION</h3>
            <div className="p-4 bg-surface-container border border-outline-variant font-mono-data text-sm leading-relaxed mb-6">
              {listing.description}
            </div>
            {listing.requiresInput && (
              <div className="mb-6 p-3 bg-primary-container/10 border border-primary font-mono-data text-xs">
                <span className="text-primary font-bold uppercase">Suggests buyer input:</span>{" "}
                {listing.inputHint || "You'll be able to describe what you want at checkout."}
              </div>
            )}
            <h3 className="font-mono-label text-mono-label font-bold text-primary mb-4">
              [02] DELIVERY CLAUSES ({listing.clauses.length})
            </h3>
            <div className="space-y-2">
              {listing.clauses.map((c, i) => (
                <div key={i} className="p-3 bg-surface-container-low border border-outline-variant font-mono-data text-xs">
                  <span className="text-primary font-bold uppercase">{c.type}</span>: {c.value} (weight {c.weight})
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 bg-surface-container-high border border-outline p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-mono-label text-mono-label text-on-surface-variant mb-4">[03] ORDER_INFO</h3>
              <p className="font-mono-data text-mono-data text-on-surface-variant">
                Buying pays escrow instantly -- no separate accept step. Generation, pinning, delivery, and
                adjudication all happen automatically afterward.
              </p>
            </div>
            {isOwner ? (
              <div className="mt-6">
                <button
                  onClick={handleDeactivate}
                  disabled={!listing.active || deactivating || deactivateLocked}
                  className="w-full py-4 border border-outline font-mono-label text-mono-label hover:bg-surface-container-highest transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deactivating || deactivateLocked ? (
                    <>
                      <InlineSpinner /> Deactivating...
                    </>
                  ) : listing.active ? (
                    "Deactivate Listing"
                  ) : (
                    "Already Inactive"
                  )}
                </button>
                {deactivateError && (
                  <div className="mt-2">
                    <ErrorBanner message={deactivateError} />
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setConfirmOpen(true);
                  setPurchaseError(null);
                  setFailedInput(null);
                  setBuyerInput("");
                }}
                disabled={!listing.active}
                className="mt-6 w-full py-4 bg-primary text-on-primary font-mono-label text-mono-label hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {listing.active ? `Buy Now -- ${formatGen(listing.priceGen)} GEN` : "Listing Inactive"}
                <span className="material-symbols-outlined text-sm">shopping_cart</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => (buying ? null : setConfirmOpen(false))}
        tag="[BUY]"
        title="CONFIRM_PURCHASE"
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={buying}
              className="px-6 py-3 border border-outline font-mono-label text-mono-label hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              CANCEL
            </button>
            <button
              onClick={handleBuyNow}
              disabled={buying || payBlocked}
              className="px-6 py-3 bg-primary text-on-primary font-mono-label text-mono-label hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {buying ? (
                <>
                  <InlineSpinner /> PROCESSING...
                </>
              ) : (
                `PAY ${formatGen(listing.priceGen)} GEN`
              )}
            </button>
          </>
        }
      >
        <p className="font-mono-data text-mono-data text-on-surface-variant leading-relaxed">
          This submits a real payable transaction for {formatGen(listing.priceGen)} GEN to the GenLayer Studio
          contract, then automatically generates, pins, delivers, and adjudicates the order.
        </p>
        {/* Always available, regardless of requiresInput -- that flag only
            changes the hint text here. Leaving it blank falls back to the
            listing's own description, exactly as before. */}
        <label className="flex flex-col gap-1 mt-4">
          <span className="font-mono-label text-[11px] text-on-surface-variant opacity-70">
            {listing.requiresInput
              ? `This listing suggests adding: ${listing.inputHint || "more detail"}`
              : "Add detail to customize this order (optional)"}
          </span>
          <textarea
            value={buyerInput}
            onChange={(e) => setBuyerInput(e.target.value)}
            placeholder={
              listing.requiresInput
                ? listing.inputHint || "Describe what you want..."
                : "Optional -- leave blank to use the listing's description as-is"
            }
            rows={3}
            className="bg-surface border border-outline p-2 font-mono-data text-sm focus:border-primary outline-none resize-none"
          />
        </label>
        {progress && (
          <p className="font-mono-data text-mono-data text-primary mt-4 leading-relaxed flex items-start gap-2">
            <InlineSpinner className="mt-0.5 shrink-0" />
            <span>{PROGRESS_LABEL[progress]}</span>
          </p>
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
