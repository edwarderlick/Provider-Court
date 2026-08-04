"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { claimSettlement, useOrder } from "@/lib/chain-client";
import { useAppState } from "@/lib/store";
import { ClauseVerdict } from "@/lib/types";
import { formatGen } from "@/lib/format";
import { ArtifactViewer } from "@/components/ArtifactViewer";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { InlineSpinner } from "@/components/InlineSpinner";
import { AppealCountdown } from "@/components/AppealCountdown";
import { useNowTick } from "@/lib/useNowTick";
import { acquireLock, isDefiniteRejection, isLocked, releaseLock } from "@/lib/tx-lock";

const VERDICT_STYLE: Record<ClauseVerdict["verdict"], string> = {
  PASS: "bg-secondary-container text-on-secondary-container",
  FAILED_SPEC: "bg-primary text-on-primary",
  MINOR_FAIL: "bg-primary-container text-on-primary-container",
};

export default function OrderVerdictPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { wallet } = useAppState();
  const { order, loading, error, refetch } = useOrder(params.id);
  const now = useNowTick();
  const verdicts = order?.clauseVerdicts ?? [];
  const targetPct = Math.round((order?.releaseFraction ?? 0) * 100);
  const [barPct, setBarPct] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  // Persists across remounts (browser back/forward, revisiting this page
  // while a previous release is still finalizing) -- the same real bug
  // already fixed once on Accept Job: plain component state resets on
  // remount, showing "Release Balance" clickable again while an earlier real
  // claim_settlement transaction for this same order was still in flight,
  // which is exactly what caused duplicate transactions.
  const [releaseLocked, setReleaseLocked] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarPct(targetPct), 300);
    return () => clearTimeout(t);
  }, [targetPct]);

  useEffect(() => {
    setReleaseLocked(isLocked(params.id, "release"));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <LoadingState fullPage label={`Reading verdict for order #${params.id}...`} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        {error ? (
          <ErrorBanner message={error} />
        ) : (
          <p className="font-mono-label text-mono-label text-on-surface-variant">
            [404] ORDER_ID "{params.id}" NOT FOUND
          </p>
        )}
      </div>
    );
  }

  async function handleRelease() {
    if (isLocked(params.id, "release")) {
      setClaimError("A release transaction for this order is already in progress -- please wait for it to finalize.");
      return;
    }
    acquireLock(params.id, "release");
    setReleaseLocked(true);
    setClaiming(true);
    setClaimError(null);
    // Same root cause as the Accept Job fix: a real transaction can be sent
    // and later error out for US (network hiccup, our own wait timing out)
    // without that meaning claim_settlement itself reverted -- releasing the
    // lock on the error alone is what let a second real transaction race the
    // first there. Once a real transaction has actually been submitted, the
    // lock is only released after a fresh read confirms whether it actually
    // landed -- never on the error alone.
    let submitted = false;
    try {
      await claimSettlement(wallet, params.id, () => {
        submitted = true;
      });
      await refetch();
      releaseLock(params.id, "release");
      setReleaseLocked(false);
    } catch (err) {
      const message = (err as Error).message;
      setClaimError(message);
      if (!submitted || isDefiniteRejection(message)) {
        // Either nothing was ever sent (wallet rejection, pre-flight
        // validation), or the contract gave a deterministic, confirmed
        // rejection ([EXPECTED] -- every validator agrees on these
        // regardless of network conditions) -- either way it's a definite
        // answer and it's safe to unlock immediately.
        releaseLock(params.id, "release");
        setReleaseLocked(false);
      } else {
        // A genuinely ambiguous error (network hiccup, our own wait timing
        // out, ERROR/UNDETERMINED consensus) -- can't tell if the tx will
        // still land, so verify against a fresh read rather than guessing.
        // `settled` (not just `state`) is the real confirmation here: state
        // was already Released/PartiallyReleased/Refunded before this call,
        // so only `settled` flipping to true actually proves the payout
        // itself went through.
        await refetch();
        try {
          const res = await fetch(`/api/chain/orders/${params.id}`, { cache: "no-store" });
          const data = await res.json().catch(() => null);
          if (data?.order && data.order.settled === true) {
            releaseLock(params.id, "release");
            setReleaseLocked(false);
          } else {
            setReleaseLocked(true);
          }
        } catch {
          setReleaseLocked(true);
        }
      }
    } finally {
      setClaiming(false);
    }
  }

  function handleAppeal() {
    router.push(`/orders/${order!.id}/appeal`);
  }

  // The contract's own appeal() already rejects this on-chain unconditionally
  // (it checks `now > appeal_deadline`, and claim_settlement can only ever
  // succeed once that same deadline has already passed -- so a genuinely
  // claimed settlement's appeal window is, by construction, always already
  // closed by the time `settled` becomes true; confirmed directly against a
  // real settled order). This is UI-side only so the button reflects that
  // reality instead of staying clickable to no effect -- clicking it today
  // would reach the contract and get a real, correct rejection, just with a
  // worse UX (an error after the fact instead of a disabled button).
  // Uses the ticking `now` (not a one-off Date.now()) so this flips to
  // closed live, the instant the real deadline passes, without needing any
  // other state change to trigger a re-render first.
  const appealWindowClosed = Boolean(order.settled || (order.deadline && new Date(order.deadline).getTime() <= now));
  const appealDisabled = order.state === "Disputed" || appealWindowClosed;
  const appealDisabledReason = order.settled
    ? "Settlement already claimed -- nothing left to appeal"
    : appealWindowClosed
      ? "Appeal window has closed"
      : null;

  return (
    <div className="flex-1">
      {/* Desktop */}
      <div className="hidden md:block bg-technical-grid px-margin-desktop py-margin-desktop space-y-gutter">
        <section className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-end justify-between border-b border-on-surface pb-2">
            <div>
              <h2 className="font-headline-lg text-headline-lg uppercase tracking-tighter">
                [01] Delivery Artifact
              </h2>
              <p className="font-mono-label text-mono-label opacity-70">
                ORDER_ID: {order.id} / PROVIDER: {order.providerName ?? "UNASSIGNED"}
                {order.listingId >= 0 && ` / LISTING: #${order.listingId}`}
              </p>
            </div>
            <div className="bg-secondary px-3 py-1 text-on-secondary font-mono-data text-mono-data">
              STATUS: {order.state.toUpperCase()}
            </div>
          </div>
          <div className="hardware-border bg-surface-container p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="font-mono-data text-mono-data bg-on-surface text-surface px-2 py-0.5">
                CONTENT_VIEWER_V1.0
              </span>
              {order.gatewayUrl && (
                <a
                  href={order.gatewayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-label text-mono-label text-primary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">download</span> VIEW_DELIVERED_ARTIFACT
                </a>
              )}
            </div>
            <p className="font-mono-data text-mono-data text-on-surface-variant mb-2">PROMPT:</p>
            <div className="font-mono-data text-body-md leading-relaxed border-l-2 border-primary pl-6 py-2">
              <p>{order.prompt}</p>
            </div>
            {order.cid && order.gatewayUrl && (
              <div className="mt-6">
                <p className="font-mono-data text-mono-data text-on-surface-variant mb-2">DELIVERED_CONTENT:</p>
                <ArtifactViewer modality={order.modality} gatewayUrl={order.gatewayUrl} />
              </div>
            )}
            {order.cid && (
              <p className="font-mono-data text-[11px] text-on-surface-variant mt-4 break-all">
                CID: {order.cid}
              </p>
            )}
          </div>
        </section>

        <section className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px bg-on-surface flex-1" />
            <h3 className="font-headline-md text-headline-md italic uppercase tracking-widest">[02] Verdicts</h3>
            <div className="h-px bg-on-surface flex-1" />
          </div>
          <div className="space-y-technical-gap">
            {verdicts.map((v) => (
              <div key={v.id} className="grid grid-cols-12 items-center hardware-border bg-surface hover:bg-surface-bright transition-colors">
                <div className="col-span-1 p-4 flex justify-center border-r border-outline">
                  <span
                    className={"material-symbols-outlined font-bold " + (v.verdict === "PASS" ? "text-secondary" : "text-primary")}
                  >
                    {v.verdict === "PASS" ? "check_circle" : "warning"}
                  </span>
                </div>
                <div className="col-span-7 p-4">
                  <div className="font-mono-label text-mono-label uppercase font-bold">Clause: {v.label}</div>
                  <div className="font-mono-data text-mono-data opacity-60">Evidence: {v.evidence}</div>
                </div>
                <div className="col-span-4 p-4 text-right">
                  <span className={"font-mono-data text-mono-data px-3 py-1 " + VERDICT_STYLE[v.verdict]}>
                    VERDICT: {v.verdict}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto pt-8">
          <div className="hardware-border bg-surface p-8 space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-mono-label text-mono-label uppercase font-black">Release Progress</h4>
                <p className="font-mono-data text-mono-data opacity-60 italic">
                  Funds held in escrow pending final validation.
                </p>
              </div>
              <div className="text-right">
                <div className="font-headline-md text-headline-md font-black">{barPct}%</div>
                <div className="font-mono-data text-mono-data uppercase">Partial Release</div>
              </div>
            </div>
            <div className="w-full h-12 hardware-border p-1 bg-surface-container-highest relative overflow-hidden">
              <div
                className="h-full bg-deep-green transition-all duration-[1500ms] ease-out"
                style={{ width: `${barPct}%` }}
              />
              <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-10" style={{ left: `${targetPct}%` }} />
            </div>
            {claimError && <ErrorBanner message={claimError} />}
            {order.deadline && <AppealCountdown deadline={order.deadline} now={now} />}
            {appealDisabledReason && order.state !== "Disputed" && (
              <p className="font-mono-data text-mono-data text-on-surface-variant opacity-70">
                [{appealDisabledReason.toUpperCase()}]
              </p>
            )}
            <div className="flex flex-col md:flex-row gap-4 justify-between pt-4">
              <div className="flex gap-4">
                <button
                  onClick={handleRelease}
                  disabled={claiming || releaseLocked || order.state === "Disputed" || order.settled}
                  title={order.settled ? "Settlement already claimed" : undefined}
                  className="bg-primary text-on-primary px-8 py-3 font-mono-label text-mono-label font-bold uppercase active:scale-95 duration-75 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {order.settled ? (
                    <>
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                      Settlement Claimed
                    </>
                  ) : claiming ? (
                    <>
                      <InlineSpinner /> Claiming...
                    </>
                  ) : releaseLocked ? (
                    <>
                      <InlineSpinner /> Release in progress...
                    </>
                  ) : (
                    "Release Balance (Claim Settlement)"
                  )}
                </button>
                <button
                  onClick={handleAppeal}
                  disabled={appealDisabled}
                  title={appealDisabledReason ?? undefined}
                  className="border border-on-surface px-8 py-3 font-mono-label text-mono-label font-bold uppercase hover:bg-on-surface hover:text-surface transition-colors active:scale-95 duration-75 disabled:opacity-50"
                >
                  Appeal Verdict
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex flex-col gap-6 px-margin-mobile pb-40">
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono-label text-mono-label text-primary">[04]</span>
            <h1 className="font-headline-md text-headline-lg-mobile uppercase">VERDICT_MANIFEST</h1>
          </div>
          <p className="font-mono-data text-mono-data text-on-surface-variant">
            DELIVERY_ID: {order.id} // STATUS: {order.state.toUpperCase()}
          </p>
        </header>

        <section className="hardware-border bg-surface-container-lowest overflow-hidden">
          <div className="bg-surface-container-low px-4 py-2 border-b border-outline flex justify-between items-center">
            <span className="font-mono-label text-mono-label uppercase">[DELIVERED_ARTIFACT]</span>
            <span className="font-mono-data text-mono-data text-on-surface-variant">V1.0.4_FINAL</span>
          </div>
          <div className="p-4 font-mono-data text-mono-data text-on-surface-variant">{order.prompt}</div>
          {order.cid && order.gatewayUrl && (
            <div className="p-4 border-t border-outline-variant">
              <ArtifactViewer modality={order.modality} gatewayUrl={order.gatewayUrl} />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono-label text-mono-label text-primary">[CLAUSE_BY_CLAUSE_AUDIT]</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>
          {verdicts.map((v, i) => (
            <div key={v.id} className="hardware-border bg-surface flex flex-col">
              <div className="flex justify-between items-start p-4 border-b border-outline-variant">
                <div className="flex flex-col">
                  <span className="font-mono-label text-mono-label text-on-surface-variant">
                    [{String(i + 1).padStart(2, "0")}]
                  </span>
                  <h3 className="font-body-lg font-bold uppercase mt-1">{v.label}</h3>
                </div>
                <div className={"flex items-center gap-2 px-3 py-1 hardware-border " + VERDICT_STYLE[v.verdict]}>
                  <span className="material-symbols-outlined text-sm">
                    {v.verdict === "PASS" ? "check_circle" : "error"}
                  </span>
                  <span className="font-mono-label text-mono-label">{v.verdict}</span>
                </div>
              </div>
              <div className="p-4 bg-surface-container-low">
                <p className="font-mono-data text-mono-data text-on-surface-variant mb-2">EVIDENCE_LOG:</p>
                <div className="font-mono-data text-mono-data bg-surface p-2 border border-outline-variant">
                  &gt; {v.evidence}
                </div>
              </div>
            </div>
          ))}
        </section>

        {verdicts.some((v) => v.verdict !== "PASS") && (
          <section className="hardware-border p-4 bg-surface-container-high border-2 border-primary">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">warning</span>
              <h4 className="font-mono-label text-mono-label text-primary uppercase">ARBITRATION_REQUIRED</h4>
            </div>
            <p className="font-body-md text-on-surface text-sm">
              Due to a failing clause, full release is pending provider remediation or manual override.
            </p>
          </section>
        )}
      </div>

      <div className="md:hidden fixed bottom-16 left-0 w-full z-40 bg-surface border-t border-outline">
        <div className="h-1 bg-surface-container">
          <div className="h-full bg-secondary transition-all duration-1000" style={{ width: `${barPct}%` }} />
        </div>
        <div className="px-margin-mobile py-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="font-mono-data text-mono-data text-on-surface-variant">FUNDS_IN_ESCROW:</span>
              <span className="font-mono-label text-mono-label font-bold">
                {formatGen(order.rewardGen)} GEN
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="font-mono-data text-mono-data text-on-surface-variant">RELEASE_READY:</span>
              <span className="font-mono-label text-mono-label text-secondary font-bold">{barPct}%</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAppeal}
              disabled={appealDisabled}
              title={appealDisabledReason ?? undefined}
              className="flex-1 bg-surface-container-high border border-outline font-mono-label text-mono-label py-4 uppercase active:bg-surface-container-highest transition-colors disabled:opacity-50"
            >
              REJECT
            </button>
            <button
              onClick={handleRelease}
              disabled={claiming || releaseLocked || order.state === "Disputed" || order.settled}
              title={order.settled ? "Settlement already claimed" : undefined}
              className="flex-[2] bg-primary text-on-primary font-mono-label text-mono-label py-4 uppercase border border-primary active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {order.settled ? (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Claimed
                </>
              ) : claiming ? (
                <>
                  <InlineSpinner /> CLAIMING...
                </>
              ) : releaseLocked ? (
                <>
                  <InlineSpinner /> IN PROGRESS...
                </>
              ) : (
                "RELEASE_PARTIAL"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
