"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useJobs, useMe } from "@/lib/chain-client";
import { useAppState } from "@/lib/store";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { JobState } from "@/lib/types";
import { formatGen } from "@/lib/format";

const TABS = [
  { key: "ALL", label: "ALL_POSTS" },
  { key: "Funded", label: "FUNDED" },
  { key: "Accepted", label: "ACCEPTED" },
  { key: "Released", label: "COMPLETED" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  Funded: "bg-secondary-container text-on-secondary-container border-secondary",
  Accepted: "bg-primary-container text-on-primary-container border-primary",
  Delivered: "bg-tertiary-container text-on-tertiary-container border-tertiary",
  Adjudicating: "bg-primary-container text-on-primary-container border-primary",
  Released: "bg-surface-dim text-on-surface-variant border-outline",
  PartiallyReleased: "bg-surface-dim text-on-surface-variant border-outline",
  Disputed: "bg-primary text-on-primary border-primary",
};

export default function BuyerDashboardPage() {
  const router = useRouter();
  const { wallet } = useAppState();
  const me = useMe();
  // The connected wallet is "you" when connected; the fixed demo buyer
  // account is only a fallback identity for the no-wallet dev path (same
  // pattern already used correctly on the provider dashboard).
  const myAddress = wallet.status === "connected" ? wallet.address : me?.buyer;
  const { jobs, loading, error } = useJobs();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ALL");

  // This previously showed every order in the system regardless of who
  // bought it -- harmless with a single demo buyer account, but genuinely
  // useless as a "find my past order" dashboard once more than one buyer
  // exists, since it becomes a wall of other people's orders. Scoped to
  // the connected wallet's own purchases now, matching the provider
  // dashboard's existing myDeliveries filter.
  const myJobs = useMemo(
    () =>
      jobs.filter(
        (j) => j.state !== "Listed" && j.buyerId?.toLowerCase() === myAddress?.toLowerCase()
      ),
    [jobs, myAddress]
  );
  const filtered = useMemo(() => {
    if (tab === "ALL") return myJobs;
    if (tab === "Released") return myJobs.filter((j) => j.state === "Released" || j.state === "PartiallyReleased");
    return myJobs.filter((j) => j.state === (tab as JobState));
  }, [myJobs, tab]);

  const totalValue = myJobs.reduce((sum, j) => sum + j.rewardGen, 0);

  return (
    <div className="bg-technical-grid flex-1 px-margin-mobile md:px-margin-desktop py-margin-desktop relative">
      <div className="max-w-[1400px] mx-auto">
        {loading && (
          <div className="mb-4">
            <LoadingState label="Reading job ledger from GenLayer Studio..." />
          </div>
        )}
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline pb-6">
          <div>
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
              <span className="text-primary font-mono-label text-mono-label block mb-1">[01] ACTIVE_LEDGER</span>
              JOB POSTING MANAGEMENT
            </h1>
            <p className="font-mono-data text-mono-data text-on-surface-variant">
              BUYER: {myAddress ?? "NOT_CONNECTED"}
            </p>
          </div>
          <div className="bg-surface-container-high px-4 py-2 border border-outline">
            <span className="font-mono-label text-mono-label text-on-surface-variant block text-[10px]">
              TOTAL VALUE HELD
            </span>
            <span className="font-mono-data text-headline-md text-on-surface">
              {formatGen(totalValue)} <span className="text-primary text-[14px]">GEN</span>
            </span>
          </div>
        </header>

        <div className="flex items-center mb-6 border-b border-outline-variant overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "px-8 py-3 font-mono-label text-mono-label transition-colors whitespace-nowrap " +
                (tab === t.key
                  ? "bg-surface border-x border-t border-outline text-primary relative -mb-[1px]"
                  : "text-on-surface-variant hover:bg-surface-container-low")
              }
            >
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 px-4">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="font-mono-data text-[10px] text-secondary">LIVE_SYNC_ENABLED</span>
          </div>
        </div>

        <div className="bg-surface border border-outline overflow-hidden overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-surface-container-low">
              <span className="material-symbols-outlined text-[64px] text-outline mb-6">terminal</span>
              <div className="font-mono-label text-mono-label text-primary mb-2">NO ACTIVE POSTINGS DETECTED.</div>
              <button
                onClick={() => router.push("/listings/browse")}
                className="px-8 py-3 bg-primary text-on-primary font-mono-label text-mono-label border border-primary hover:bg-transparent hover:text-primary transition-all active:scale-95"
              >
                [EXECUTE] NEW_CONTRACT_INIT
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container text-on-surface-variant border-b border-outline">
                <tr>
                  <th className="px-6 py-4 font-mono-label text-mono-label uppercase tracking-wider">Job ID</th>
                  <th className="px-6 py-4 font-mono-label text-mono-label uppercase tracking-wider">Modality</th>
                  <th className="px-6 py-4 font-mono-label text-mono-label uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 font-mono-label text-mono-label uppercase tracking-wider">
                    Value (GEN)
                  </th>
                  <th className="px-6 py-4 font-mono-label text-mono-label uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-mono-data">
                {filtered.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-on-surface font-bold">#{job.id}</span>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">{job.modality}</td>
                    <td className="px-6 py-4">
                      <span
                        className={
                          "px-2 py-1 text-[11px] font-bold border " +
                          (STATUS_STYLE[job.state] ?? "bg-surface-dim text-on-surface-variant border-outline")
                        }
                      >
                        {job.state.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-on-surface">{formatGen(job.rewardGen)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => router.push(`/orders/${job.id}`)}
                        className="px-4 py-1 border border-outline font-mono-label text-mono-label hover:bg-primary hover:text-on-primary transition-all"
                      >
                        OPEN
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <div className="border border-outline bg-surface p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="font-mono-label text-mono-label text-on-surface-variant">[STABILITY]</span>
              <span className="material-symbols-outlined text-secondary">trending_up</span>
            </div>
            <div className="font-headline-md text-headline-md text-on-surface">99.8%</div>
          </div>
          <div className="border border-outline bg-surface p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="font-mono-label text-mono-label text-on-surface-variant">[NODES]</span>
              <span className="material-symbols-outlined text-primary">hub</span>
            </div>
            <div className="font-headline-md text-headline-md text-on-surface">1,402</div>
          </div>
          <div className="border border-outline bg-surface p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="font-mono-label text-mono-label text-on-surface-variant">[GAS_OPTIM]</span>
              <span className="material-symbols-outlined text-tertiary">bolt</span>
            </div>
            <div className="font-headline-md text-headline-md text-on-surface">14 GWEI</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => router.push("/listings/browse")}
        className="fixed bottom-20 lg:bottom-8 right-8 w-14 h-14 bg-primary text-on-primary flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all z-50"
        aria-label="Post a new job"
      >
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
}
