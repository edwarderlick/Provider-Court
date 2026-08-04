"use client";

import { useMemo } from "react";
import { useJobs } from "@/lib/chain-client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ActivityEntry } from "@/lib/types";

const OUTCOME_STYLE: Record<ActivityEntry["outcome"], string> = {
  PARTIAL_RELEASE: "bg-secondary-container text-on-secondary-container border-secondary",
  FULL_ESCROW_RELEASE: "bg-primary-fixed text-on-primary-fixed-variant border-primary",
  NULL_SETTLEMENT: "bg-surface-container-highest text-on-surface-variant border-outline",
};

export default function ActivityFeedPage() {
  const { jobs, loading, error } = useJobs();

  // Derived directly from real settled jobs (no synthetic/random feed) --
  // every settlement outcome the contract has actually recorded so far.
  const entries: ActivityEntry[] = useMemo(
    () =>
      jobs
        .filter((j) => j.state === "Released" || j.state === "PartiallyReleased" || j.state === "Refunded")
        .map((j) => ({
          id: j.id,
          timestamp: j.deadline ?? "",
          jobId: `#${j.id}`,
          modality: j.modality,
          outcome:
            j.state === "Released"
              ? "FULL_ESCROW_RELEASE"
              : j.state === "Refunded"
                ? "NULL_SETTLEMENT"
                : "PARTIAL_RELEASE",
          releaseFraction: j.releaseFraction ?? 0,
        })),
    [jobs]
  );

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-margin-desktop">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b-2 border-outline pb-4 gap-4">
          <div className="flex flex-col gap-2">
            <span className="font-mono-label text-mono-label text-primary">[SYSTEM_LOG_ACCESS]</span>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg uppercase">
              Settlement Activity Ledger
            </h1>
          </div>
          <div className="text-right">
            <div className="font-mono-data text-mono-data text-on-surface-variant">NETWORK</div>
            <div className="font-mono-label text-mono-label text-secondary font-bold">GenLayer Studio</div>
          </div>
        </div>

        {loading && (
          <div className="mb-4">
            <LoadingState label="Reading settlement history from GenLayer Studio..." />
          </div>
        )}
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="border border-outline bg-surface-container-lowest overflow-hidden overflow-x-auto">
          <div className="grid grid-cols-12 gap-gutter px-6 py-4 bg-surface-container-high border-b border-outline font-mono-label text-mono-label min-w-[640px]">
            <div className="col-span-2">APPEAL_DEADLINE</div>
            <div className="col-span-3">JOB_ID_TAG</div>
            <div className="col-span-2">MODALITY</div>
            <div className="col-span-3">PROTOCOL_OUTCOME</div>
            <div className="col-span-2 text-right">REL_FRAC</div>
          </div>
          <div className="divide-y divide-outline-variant min-w-[640px]">
            {entries.length === 0 && (
              <div className="px-6 py-8 text-center font-mono-data text-mono-data text-on-surface-variant">
                No settled jobs yet.
              </div>
            )}
            {entries.map((e) => (
              <div key={e.id} className="grid grid-cols-12 gap-gutter px-6 py-5 items-center hover:bg-surface-bright transition-colors">
                <div className="col-span-2 font-mono-data text-mono-data text-on-surface-variant truncate">
                  {e.timestamp}
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  <span className="font-mono-label text-mono-label bg-surface-container text-primary px-2 border border-outline-variant">
                    {e.jobId}
                  </span>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <span className="font-mono-label text-mono-label uppercase">{e.modality}</span>
                </div>
                <div className="col-span-3">
                  <span className={"px-2 py-0.5 font-mono-label text-mono-label border " + OUTCOME_STYLE[e.outcome]}>
                    {e.outcome}
                  </span>
                </div>
                <div className="col-span-2 text-right font-mono-data text-headline-md leading-none text-primary">
                  {e.releaseFraction.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
