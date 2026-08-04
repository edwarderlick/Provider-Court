"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { resolveAppeal, useOrder } from "@/lib/chain-client";
import { useAppState } from "@/lib/store";
import { acquireLock, isLocked, releaseLock } from "@/lib/tx-lock";
import { JobState, Order } from "@/lib/types";
import { formatGen } from "@/lib/format";
import { ArtifactViewer } from "@/components/ArtifactViewer";
import { PipelineProgress } from "@/components/PipelineProgress";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { InlineSpinner } from "@/components/InlineSpinner";

const STATE_BADGE: Record<JobState, { label: string; className: string }> = {
  Listed: { label: "STATUS: LISTED", className: "bg-surface-container-highest text-on-surface-variant" },
  Funded: { label: "STATUS: FUNDED", className: "bg-secondary-container text-on-secondary-container" },
  Accepted: { label: "STATUS: PAID -- AUTO-FULFILLING", className: "bg-primary text-on-primary" },
  Delivered: { label: "STATUS: DELIVERED", className: "bg-tertiary-container text-on-tertiary-container" },
  Adjudicating: { label: "STATUS: ADJUDICATING", className: "bg-primary-container text-on-primary-container" },
  Released: { label: "STATUS: RELEASED", className: "bg-secondary text-on-secondary" },
  PartiallyReleased: { label: "STATUS: RELEASED_PARTIAL", className: "bg-secondary text-on-secondary" },
  Refunded: { label: "STATUS: REFUNDED", className: "bg-surface-dim text-on-surface-variant" },
  Disputed: { label: "STATE: DISPUTED", className: "bg-primary text-on-primary" },
  Cancelled: { label: "STATUS: CANCELLED", className: "bg-surface-dim text-on-surface-variant" },
  Expired: { label: "STATUS: EXPIRED", className: "bg-surface-dim text-on-surface-variant" },
  Missed: { label: "STATUS: MISSED_DEADLINE", className: "bg-error text-on-error" },
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { wallet } = useAppState();
  const { order, loading, error, refetch } = useOrder(params.id);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fulfillLocked, setFulfillLocked] = useState(false);
  const [resolveAppealLocked, setResolveAppealLocked] = useState(false);
  // Set only when we arrived here right after a purchase whose payment
  // succeeded but whose automatic generation/delivery pipeline did not --
  // a genuine post-payment failure, distinct from a clause-adjudication
  // outcome, and must be shown as such rather than silently folded into
  // the generic "auto-generating" waiting copy (see Task 4).
  const [fulfillFailureBanner, setFulfillFailureBanner] = useState<string | null>(
    searchParams.get("fulfillError")
  );

  useEffect(() => {
    setFulfillLocked(isLocked(params.id, "fulfill"));
    setResolveAppealLocked(isLocked(params.id, "resolve-appeal"));
  }, [params.id]);

  // Payment IS the claim -- there is no manual accept/deliver step in this
  // flow anymore. Generation + delivery + adjudication all happen
  // automatically (see lib/chain-client.ts's purchaseListing and
  // /api/chain/orders/[id]/auto-fulfill). This button only exists as a
  // recovery path if that automatic pipeline was interrupted (a closed tab,
  // a network hiccup) -- autoFulfillOrder() resumes correctly from wherever
  // the order's real on-chain state actually is (Accepted or Delivered),
  // it never re-runs a step that already succeeded.
  async function handleRetryFulfillment() {
    if (isLocked(params.id, "fulfill")) return;
    acquireLock(params.id, "fulfill");
    setFulfillLocked(true);
    setActionPending(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/chain/orders/${params.id}/auto-fulfill`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? res.statusText);
      setFulfillFailureBanner(null);
      await refetch();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      releaseLock(params.id, "fulfill");
      setFulfillLocked(false);
      setActionPending(false);
    }
  }

  async function handleResolveAppeal() {
    if (!order?.cid) return;
    if (isLocked(params.id, "resolve-appeal")) return;
    acquireLock(params.id, "resolve-appeal");
    setResolveAppealLocked(true);
    setActionPending(true);
    setActionError(null);
    try {
      await resolveAppeal(wallet, params.id, order.cid);
      await refetch();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      releaseLock(params.id, "resolve-appeal");
      setResolveAppealLocked(false);
      setActionPending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <LoadingState fullPage label={`Reading order #${params.id} from GenLayer Studio...`} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 py-32">
        {error ? (
          <ErrorBanner message={error} />
        ) : (
          <p className="font-mono-label text-mono-label text-on-surface-variant">
            [404] ORDER_ID "{params.id}" NOT FOUND ON-CHAIN
          </p>
        )}
        <Link href="/listings/browse" className="text-primary underline font-mono-label text-mono-label">
          Return to Browse Listings
        </Link>
      </div>
    );
  }

  const badge = STATE_BADGE[order.state];

  return (
    <div className="bg-technical-grid flex-1 px-margin-mobile md:px-margin-desktop py-margin-desktop relative">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-outline pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={"px-2 py-1 font-mono-data text-mono-data font-bold " + badge.className}>
                {badge.label}
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase tracking-tight">
              Order_ID: #{order.id}
            </h2>
            <p className="font-mono-label text-mono-label text-on-surface-variant mt-1">
              {order.title}
              {order.listingId >= 0 && (
                <>
                  {" "}
                  <Link href={`/listings/${order.listingId}`} className="text-primary underline">
                    (from listing #{order.listingId})
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono-data text-mono-data text-on-surface-variant block">
              MODALITY: {order.modality}
            </span>
            <span className="font-mono-data text-mono-data text-primary font-bold">
              {formatGen(order.rewardGen)} GEN PAID
            </span>
          </div>
        </div>

        {actionError && (
          <div className="mb-4">
            <ErrorBanner message={actionError} />
          </div>
        )}

        {(order.state === "Accepted" || order.state === "Delivered") && (
          <AutoFulfillingBody
            order={order}
            pending={actionPending || fulfillLocked}
            onRetry={handleRetryFulfillment}
            onPipelineComplete={refetch}
            fulfillFailureBanner={fulfillFailureBanner}
          />
        )}

        {order.state === "Adjudicating" && <AdjudicatingBody orderId={order.id} />}

        {(order.state === "Released" || order.state === "PartiallyReleased" || order.state === "Refunded") && (
          <SettledBody orderId={order.id} state={order.state} fraction={order.releaseFraction ?? 1} />
        )}

        {order.state === "Disputed" && (
          <DisputedBody
            order={order}
            pending={actionPending || resolveAppealLocked}
            onResolveAppeal={handleResolveAppeal}
          />
        )}

        {(order.state === "Cancelled" || order.state === "Expired" || order.state === "Missed") && (
          <TerminalBody state={order.state} />
        )}

        {/* Fallback for states this page has no dedicated body for -- namely
            "Listed"/"Funded", pre-accept states only the old create_job()
            flow could produce (a real purchase() order starts life already
            Accepted). No current job/order is in either state, and nothing
            in the app can create a new one anymore, but the dashboards now
            route every job/order here regardless of which flow created it,
            so this must not render blank if one ever is. */}
        {(order.state === "Listed" || order.state === "Funded") && (
          <div className="bg-surface-dim border border-outline p-8 text-center">
            <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4 inline-block">
              hourglass_empty
            </span>
            <h3 className="font-mono-label text-mono-label font-bold uppercase">
              STATUS: {order.state}
            </h3>
            <p className="font-mono-data text-mono-data text-on-surface-variant mt-2">
              This job predates the current listing/purchase flow and has no provider
              assigned yet. There is no longer a UI path to accept it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AutoFulfillingBody({
  order,
  pending,
  onRetry,
  onPipelineComplete,
  fulfillFailureBanner,
}: {
  order: Order;
  pending: boolean;
  onRetry: () => void;
  onPipelineComplete: () => void;
  fulfillFailureBanner: string | null;
}) {
  return (
    <div className="grid grid-cols-12 gap-gutter">
      {fulfillFailureBanner && (
        <div className="col-span-12 bg-error/10 border border-error p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-error">warning</span>
          <div>
            <p className="font-mono-label text-mono-label font-bold text-error uppercase">
              Payment succeeded -- automatic generation hit an error
            </p>
            <p className="font-mono-data text-mono-data text-on-surface-variant mt-1">
              Your {formatGen(order.rewardGen)} GEN payment is already confirmed on-chain. This is not a
              clause-adjudication result -- the generation/delivery step itself failed: "{fulfillFailureBanner}
              ". Click "Retry automatic fulfillment" below to resume; it picks up safely from wherever this
              order actually is and will not charge you again.
            </p>
          </div>
        </div>
      )}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-technical-gap">
        <div className="bg-surface border border-outline p-6 relative overflow-hidden">
          <div className="scanline" />
          <div className="flex justify-between items-start border-b border-outline pb-4 mb-6">
            <h3 className="font-mono-label text-mono-label font-bold text-primary">[01] PARAMETERS</h3>
            <span className="font-mono-data text-mono-data text-on-surface-variant">
              MODALITY_LOCK: {order.modality}
            </span>
          </div>
          <label className="block font-mono-label text-mono-label text-on-surface-variant mb-2">
            CORE_PROMPT
          </label>
          <div className="p-4 bg-surface-container border border-outline-variant font-mono-data text-sm leading-relaxed">
            {order.prompt}
          </div>
        </div>
        {order.cid && order.gatewayUrl && (
          <div className="bg-surface border border-outline p-6">
            <div className="flex justify-between items-center border-b border-outline pb-4 mb-6">
              <h3 className="font-mono-label text-mono-label font-bold text-primary">[02] DELIVERED_ARTIFACT</h3>
              <span className="font-mono-data text-mono-data text-on-surface-variant">
                Visible now -- adjudication verdict not required
              </span>
            </div>
            <ArtifactViewer modality={order.modality} gatewayUrl={order.gatewayUrl} />
          </div>
        )}
      </div>
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-technical-gap">
        <div className="bg-surface border border-outline p-8 flex flex-col items-center text-center gap-4">
          <h3 className="font-mono-label text-mono-label font-bold uppercase">Auto-fulfilling this order</h3>
          <p className="font-mono-data text-mono-data text-on-surface-variant">
            Payment already confirmed on-chain -- no further action is required from you.
          </p>
          <div className="w-full text-left border border-outline-variant bg-surface-container-low p-4">
            <PipelineProgress orderId={order.id} active={true} onComplete={onPipelineComplete} />
          </div>
          <button
            onClick={onRetry}
            disabled={pending}
            className="mt-2 px-6 py-3 border border-outline font-mono-label text-mono-label hover:bg-surface-container-high transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pending ? (
              <>
                <InlineSpinner /> Working...
              </>
            ) : (
              "Retry automatic fulfillment"
            )}
          </button>
          <p className="font-mono-data text-[10px] text-on-surface-variant">
            (Only needed if this has been stuck for several minutes -- safe to click, it resumes from
            wherever this order actually is on-chain.)
          </p>
        </div>
        {order.providerId && (
          <div className="bg-surface border border-outline p-4">
            <Link href={`/providers/${order.providerId}`} className="text-primary font-mono-data text-xs underline">
              View provider profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function AdjudicatingBody({ orderId }: { orderId: string }) {
  return (
    <div className="bg-surface border border-outline p-8 flex flex-col items-center text-center gap-4">
      <span className="material-symbols-outlined text-primary text-5xl">gavel</span>
      <h3 className="font-mono-label text-mono-label font-bold uppercase">Adjudication in progress</h3>
      <p className="font-mono-data text-mono-data text-on-surface-variant max-w-md">
        The GenLayer intelligent contract is evaluating each clause against the delivered artifact via real
        validator consensus. This can take up to a minute.
      </p>
      <Link
        href={`/orders/${orderId}/verdict`}
        className="mt-2 px-8 py-3 bg-primary text-on-primary font-mono-label text-mono-label hover:opacity-90 transition-opacity"
      >
        View Verdict Manifest
      </Link>
    </div>
  );
}

function SettledBody({
  orderId,
  state,
  fraction,
}: {
  orderId: string;
  state: JobState;
  fraction: number;
}) {
  const pct = Math.round(fraction * 100);
  return (
    <div className="hardware-border bg-surface p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="font-mono-label text-mono-label uppercase font-black">
          {state === "Refunded" ? "Escrow Refunded" : "Release Complete"}
        </h4>
        <div className="text-right">
          <div className="font-headline-md text-headline-md font-black">{state === "Refunded" ? "0%" : `${pct}%`}</div>
          <div className="font-mono-data text-mono-data uppercase">{state}</div>
        </div>
      </div>
      <div className="w-full h-12 hardware-border p-1 bg-surface-container-highest relative overflow-hidden">
        <div
          className="h-full bg-deep-green"
          style={{ width: `${state === "Refunded" ? 0 : pct}%` }}
        />
      </div>
      <Link
        href={`/orders/${orderId}/verdict`}
        className="inline-block px-8 py-3 bg-primary text-on-primary font-mono-label text-mono-label hover:opacity-90 transition-opacity"
      >
        View Verdict / Claim Settlement
      </Link>
    </div>
  );
}

function DisputedBody({
  order,
  pending,
  onResolveAppeal,
}: {
  order: Order;
  pending: boolean;
  onResolveAppeal: () => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-gutter">
      <div className="col-span-12 lg:col-span-8 border border-outline bg-surface">
        <div className="bg-surface-container-low border-b border-outline px-6 py-3 flex justify-between items-center">
          <span className="font-mono-label text-mono-label font-bold">[01] APPEAL_SPECIFICATION</span>
          <span className="font-mono-data text-mono-data bg-primary-container text-on-primary-container px-2 py-0.5">
            HIGH_PRIORITY
          </span>
        </div>
        <div className="p-6 space-y-4">
          <p className="font-body-md text-body-md text-on-surface-variant">
            This order is currently under dispute. Re-adjudication re-runs clause verdicts via a fresh GenVM
            consensus round.
          </p>
          <button
            onClick={onResolveAppeal}
            disabled={pending}
            className="px-8 py-3 bg-primary text-on-primary font-mono-label text-mono-label hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pending ? (
              <>
                <InlineSpinner /> Re-adjudicating...
              </>
            ) : (
              "Resolve Appeal (Re-adjudicate)"
            )}
          </button>
        </div>
      </div>
      <div className="col-span-12 lg:col-span-4 border border-outline bg-surface p-6">
        <span className="font-mono-label text-mono-label font-bold block mb-4">[02] DISPUTE_BOND</span>
        <p className="text-3xl font-bold font-mono-data text-on-surface">
          {formatGen(order.disputeBondGen ?? 0)} <span className="text-lg opacity-40">GEN</span>
        </p>
        <p className="font-mono-data text-mono-data text-secondary mt-2">STATUS: LOCKED</p>
      </div>
    </div>
  );
}

function TerminalBody({ state }: { state: JobState }) {
  return (
    <div className="bg-surface-dim border border-outline p-8 text-center">
      <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4 inline-block">
        {state === "Missed" ? "report" : "block"}
      </span>
      <h3 className="font-mono-label text-mono-label font-bold uppercase">STATUS: {state}</h3>
      <p className="font-mono-data text-mono-data text-on-surface-variant mt-2">
        This contract is closed. No further action is possible.
      </p>
    </div>
  );
}
