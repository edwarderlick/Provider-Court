"use client";

import { useEffect, useRef, useState } from "react";

// Mirrors lib/fulfill-progress.ts's FulfillStage exactly -- these are the
// real, distinct stages autoFulfillOrder passes through server-side
// (generate+pin is one bundled real step from this app's vantage point,
// since lib/generate-content.ts's generateContent() returns both in one
// call; see fulfill-progress.ts's own comment for why splitting it further
// would require changing that function's contract, which this fix doesn't
// do). Polling this rather than a timer is what keeps this honest: a stage
// only advances here because the server-side code actually reached that
// await, not because a fixed number of seconds elapsed.
type FulfillStage = "generating" | "delivering" | "consensus";

const STAGES: { key: FulfillStage; label: string }[] = [
  { key: "generating", label: "Generating & pinning content" },
  { key: "delivering", label: "Submitting for delivery" },
  { key: "consensus", label: "GenVM consensus in progress" },
];

type RowState = "done" | "active" | "pending";

export function PipelineProgress({
  orderId,
  active,
  onComplete,
}: {
  orderId: string | number;
  active: boolean;
  // Fires exactly once, the first time this poll observes the pipeline has
  // finished -- lets the order detail page refetch the order itself (state,
  // cid) the moment this checklist reaches "Verdict ready" instead of the
  // buyer seeing a stale "PAID -- AUTO-FULFILLING" badge above a completed
  // checklist until they manually reload.
  onComplete?: () => void;
}) {
  const [stage, setStage] = useState<FulfillStage | null>(null);
  // Once we've observed ANY real stage at least once, a later null reading
  // means the pipeline finished (not that it hasn't started yet) -- without
  // this, the brief window before the first poll lands would look
  // indistinguishable from "already done."
  const startedRef = useRef(false);
  const [everStarted, setEverStarted] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/chain/orders/${orderId}/fulfill-progress`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        const nextStage: FulfillStage | null = data?.progress?.stage ?? null;
        if (nextStage) {
          startedRef.current = true;
          setEverStarted(true);
        } else if (startedRef.current && !completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
        setStage(nextStage);
      } catch {
        // Transient poll failure -- next tick retries, no need to surface this.
      }
    }

    poll();
    const interval = setInterval(poll, 1200);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId, active, onComplete]);

  const allDone = everStarted && stage === null;
  // Before the very first poll actually observes a real stage (server-side,
  // autoFulfillOrder's own pre-check/concurrency-scan overhead runs before
  // the first setFulfillStage call), stage is still null here even though
  // work is genuinely already underway -- confirmed directly by screenshotting
  // this exact window against a real order: every row rendered as a plain
  // pending circle with no indication anything was happening at all, the
  // precise complaint this component exists to prevent. Defaulting to
  // index 0 (rather than -1) whenever active and not yet done means the
  // first real stage always reads as in-progress immediately, which is
  // never dishonest -- if nothing else has been observed yet, "generating"
  // genuinely is the stage that's either running or about to be.
  const currentIndex = stage ? STAGES.findIndex((s) => s.key === stage) : allDone ? STAGES.length : 0;

  return (
    <div className="space-y-2">
      <StageRow label="Payment confirmed" state="done" />
      {STAGES.map((s, i) => {
        const state: RowState = allDone || i < currentIndex ? "done" : i === currentIndex ? "active" : "pending";
        return <StageRow key={s.key} label={s.label} state={state} />;
      })}
      <StageRow label="Verdict ready" state={allDone ? "done" : "pending"} />
      {!allDone && (
        <p className="font-mono-data text-[11px] text-on-surface-variant pt-2 border-t border-outline-variant mt-2">
          Typically 3-4 minutes end-to-end (real generation + real GenVM multi-validator
          consensus, not a fixed delay) -- this is normal, not stuck.
        </p>
      )}
    </div>
  );
}

function StageRow({ label, state }: { label: string; state: RowState }) {
  const icon = state === "done" ? "check_circle" : state === "active" ? "autorenew" : "radio_button_unchecked";
  const iconClass =
    state === "done" ? "text-secondary" : state === "active" ? "text-primary animate-spin" : "text-on-surface-variant opacity-40";
  const textClass =
    state === "pending" ? "text-on-surface-variant opacity-50" : state === "active" ? "text-on-surface font-bold" : "text-on-surface-variant";
  const rowClass = state === "active" ? "bg-primary/10 border-l-4 border-primary -ml-4 pl-3 py-1" : "";
  return (
    <div className={`flex items-center gap-3 ${rowClass}`}>
      <span className={`material-symbols-outlined text-lg ${iconClass}`}>{icon}</span>
      <span className={`font-mono-data text-sm ${textClass}`}>{label}</span>
    </div>
  );
}
