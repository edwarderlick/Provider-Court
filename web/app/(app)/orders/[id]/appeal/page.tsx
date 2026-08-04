"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { appealJob, useOrder } from "@/lib/chain-client";
import { useAppState } from "@/lib/store";
import { acquireLock, isLocked, releaseLock } from "@/lib/tx-lock";
import { Modal } from "@/components/Modal";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { InlineSpinner } from "@/components/InlineSpinner";
import { AppealCountdown } from "@/components/AppealCountdown";
import { useNowTick } from "@/lib/useNowTick";
import { ClauseVerdict } from "@/lib/types";
import { formatGen } from "@/lib/format";

const VERDICT_STYLE: Record<ClauseVerdict["verdict"], string> = {
  PASS: "bg-secondary-container text-on-secondary-container",
  FAILED_SPEC: "bg-primary text-on-primary",
  MINOR_FAIL: "bg-primary-container text-on-primary-container",
};

export default function OrderAppealPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { wallet } = useAppState();
  const { order, loading, error } = useOrder(params.id);
  const now = useNowTick();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [appealLocked, setAppealLocked] = useState(false);

  useEffect(() => {
    setAppealLocked(isLocked(params.id, "appeal"));
  }, [params.id]);

  // Bond comes directly from the order's real on-chain dispute_bond_atto
  // (set at listing-creation time) rather than being recomputed client-side.
  // There is no separate "network fee" -- GenLayer Studio is gasless, and the
  // contract's own appeal() requires the attached value to equal
  // dispute_bond_atto exactly (see provider_court_escrow.py:715), nothing more.
  const bond = order?.disputeBondGen ?? 0;
  const verdicts = order?.clauseVerdicts ?? [];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <LoadingState fullPage label="Reading order from GenLayer Studio..." />
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

  async function submitAppeal() {
    if (isLocked(params.id, "appeal")) {
      setSubmitError("An appeal for this order is already in progress -- please wait for it to finalize.");
      return;
    }
    acquireLock(params.id, "appeal");
    setAppealLocked(true);
    setSubmitting(true);
    setSubmitError(null);
    try {
      await appealJob(wallet, order!.id, order!.disputeBondGen ?? 0);
      releaseLock(params.id, "appeal");
      setAppealLocked(false);
      setConfirmOpen(false);
      router.push(`/orders/${order!.id}`);
    } catch (err) {
      setSubmitError((err as Error).message);
      releaseLock(params.id, "appeal");
      setAppealLocked(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 relative overflow-hidden px-margin-mobile md:px-margin-desktop py-margin-desktop">
      <div className="bg-technical-grid absolute inset-0 z-0 pointer-events-none opacity-40" />
      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <div className="font-mono-label text-mono-label text-primary mb-2">
              [APPEAL-01] // INITIATE_DISPUTE_ESCALATION
            </div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
              Appeal Protocol — {order.id}
            </h1>
          </div>
          {order.deadline && (
            <div className="flex items-center gap-3 bg-surface-container px-4 py-2 border border-outline">
              <span className="material-symbols-outlined text-primary text-sm">schedule</span>
              <AppealCountdown deadline={order.deadline} now={now} />
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmOpen(true);
          }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-gutter"
        >
          <div className="lg:col-span-8 flex flex-col gap-gutter">
            <section className="bg-surface border border-outline p-6">
              <div className="flex items-center gap-2 mb-4 border-b border-outline pb-2">
                <span className="material-symbols-outlined text-primary">gavel</span>
                <h2 className="font-mono-label text-mono-label font-bold uppercase">
                  Clauses From This Order's Verdict
                </h2>
              </div>
              <p className="font-body-md text-sm text-on-surface-variant mb-4">
                Appealing re-runs adjudication against every clause below, not a chosen subset --
                the contract's <code className="font-mono-data text-xs">appeal()</code> has no
                per-clause selection, so this is a review of what you're disputing, not a filter.
              </p>
              <div className="space-y-3">
                {verdicts.length === 0 && (
                  <p className="font-mono-data text-mono-data text-on-surface-variant opacity-70">
                    No clause verdicts recorded for this order yet.
                  </p>
                )}
                {verdicts.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-start justify-between gap-4 p-4 bg-surface-container-low border border-outline"
                  >
                    <div>
                      <span className="font-mono-label text-mono-label block text-on-surface mb-1">
                        {v.label}
                      </span>
                      <p className="font-body-md text-sm text-on-surface-variant">Evidence: {v.evidence}</p>
                    </div>
                    <span
                      className={"shrink-0 font-mono-data text-mono-data px-3 py-1 " + VERDICT_STYLE[v.verdict]}
                    >
                      {v.verdict}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-gutter">
            <section className="bg-surface-container border-2 border-primary p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono-label text-mono-label font-bold uppercase text-primary">Bond Required</h2>
                <span className="material-symbols-outlined text-primary">security</span>
              </div>
              <div className="bg-white/50 border border-outline-variant p-4 mb-4">
                <div className="text-xs font-mono-data text-on-surface-variant mb-1">STAKING_CURRENCY:</div>
                <div className="text-3xl font-headline-md text-on-surface">
                  {formatGen(bond)} <span className="text-lg font-mono-label">GEN</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-error text-sm">report_problem</span>
                <div className="text-[11px] font-mono-data leading-tight text-on-surface-variant">
                  If re-adjudication changes the release outcome, you get this bond back. If it
                  doesn't change, the other party (provider or buyer) receives it instead --
                  never burned.
                </div>
              </div>
              <p className="font-mono-data text-[10px] text-outline italic">
                GenLayer Studio is gasless -- this bond is the only amount charged, no separate
                network fee.
              </p>
            </section>

            <section className="bg-surface border border-outline overflow-hidden">
              <div className="p-6">
                <p className="font-body-md text-sm text-on-surface-variant">
                  Submitting locks this bond and moves the order into the Disputed state. A
                  second real GenVM consensus round then re-adjudicates every clause above
                  against the same delivered artifact -- triggered separately from the order's
                  detail page once Disputed, and typically finishing in under a minute once
                  triggered (the same real adjudication used the first time, not a separate
                  review process).
                </p>
              </div>
            </section>

            <button
              type="submit"
              className="group w-full py-6 bg-primary text-on-primary font-headline-md text-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] border-b-4 border-primary-container"
            >
              <span className="font-bold tracking-widest">SUBMIT APPEAL</span>
              <span className="font-mono-label text-xs opacity-70 group-hover:opacity-100 transition-opacity">
                EXECUTE_SMART_CONTRACT_TRANSACTION
              </span>
            </button>
          </div>
        </form>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        tag="[APPEAL]"
        title="CONFIRM_SUBMISSION"
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-6 py-3 border border-outline font-mono-label text-mono-label hover:bg-surface-container-high transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={submitAppeal}
              disabled={submitting || appealLocked}
              className="px-6 py-3 bg-primary text-on-primary font-mono-label text-mono-label hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting || appealLocked ? (
                <>
                  <InlineSpinner /> SUBMITTING...
                </>
              ) : (
                `STAKE ${formatGen(bond)} GEN & SUBMIT`
              )}
            </button>
          </>
        }
      >
        <p className="font-mono-data text-mono-data text-on-surface-variant leading-relaxed">
          This locks a {formatGen(bond)} GEN bond and moves order <span className="text-primary font-bold">{order.id}</span> into
          the Disputed state pending re-adjudication. This submits a real transaction to the GenLayer Studio
          contract.
        </p>
        {submitError && (
          <div className="mt-4">
            <ErrorBanner message={submitError} />
          </div>
        )}
      </Modal>
    </div>
  );
}
