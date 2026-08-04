"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deliverJob, useJobs, useMe, useProvider } from "@/lib/chain-client";
import { useAppState } from "@/lib/store";
import { acquireLock, isLocked, releaseLock } from "@/lib/tx-lock";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatGen } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  Accepted: "bg-secondary-container text-on-secondary-container border-secondary",
  Delivered: "bg-tertiary-container text-on-tertiary-container border-tertiary",
  Adjudicating: "bg-surface-container-highest text-primary border-primary",
  PartiallyReleased: "bg-surface-dim text-on-surface-variant border-outline",
  Released: "bg-surface-dim text-on-surface-variant border-outline",
  Disputed: "bg-primary text-on-primary border-primary",
};

export default function ProviderDashboardPage() {
  const router = useRouter();
  const { wallet } = useAppState();
  const me = useMe();
  // The connected wallet is "you" when connected; the fixed demo provider
  // account is only used as a fallback identity for the no-wallet dev path.
  const myAddress = wallet.status === "connected" ? wallet.address : me?.provider;
  const { jobs, loading, error, refetch } = useJobs();
  const { provider, loading: providerLoading } = useProvider(myAddress ?? undefined);
  const [delivering, setDelivering] = useState<string | null>(null);
  const [deliverError, setDeliverError] = useState<string | null>(null);

  const myDeliveries = useMemo(
    () => jobs.filter((j) => j.providerId?.toLowerCase() === myAddress?.toLowerCase()),
    [jobs, myAddress]
  );
  const inProgress = myDeliveries.filter((j) => j.state === "Accepted" || j.state === "Delivered" || j.state === "Adjudicating").length;
  const totalEarned = myDeliveries
    .filter((j) => j.state === "Released" || j.state === "PartiallyReleased")
    .reduce((sum, j) => sum + j.rewardGen * (j.releaseFraction ?? 1), 0);

  async function handleSubmitDelivery(jobId: string) {
    const job = myDeliveries.find((j) => j.id === jobId);
    if (!job) return;
    if (isLocked(jobId, "deliver")) {
      setDeliverError("A delivery for this job is already in progress -- please wait for it to finalize.");
      return;
    }
    acquireLock(jobId, "deliver");
    setDelivering(jobId);
    setDeliverError(null);
    try {
      await deliverJob(wallet, jobId, job);
      await refetch();
    } catch (err) {
      setDeliverError((err as Error).message);
    } finally {
      releaseLock(jobId, "deliver");
      setDelivering(null);
    }
  }

  return (
    <div className="bg-technical-grid flex-1 px-margin-mobile md:px-margin-desktop py-margin-desktop space-y-gutter">
      {loading && <LoadingState label="Reading deliveries from GenLayer Studio..." />}
      {error && <ErrorBanner message={error} />}
      {deliverError && <ErrorBanner message={deliverError} />}
      <header className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div className="space-y-1">
          <h1 className="font-headline-md text-headline-md text-primary uppercase">[03] DELIVERIES_HUB</h1>
          <p className="font-mono-data text-mono-data text-on-surface-variant">
            PROVIDER: {myAddress ?? "NOT_CONNECTED"}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-end border-r border-outline pr-4">
            <span className="font-mono-data text-mono-data opacity-50 uppercase">Network Load</span>
            <span className="font-mono-label text-mono-label text-secondary">0.024 MS</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-mono-data text-mono-data opacity-50 uppercase">Block Height</span>
            <span className="font-mono-label text-mono-label">#18,492,021</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div className="bg-surface border border-outline p-6 space-y-4 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="font-mono-label text-mono-label text-on-surface-variant opacity-60">[ID_01]</span>
            <span className="material-symbols-outlined text-primary">pending_actions</span>
          </div>
          <div>
            <p className="font-mono-data text-mono-data uppercase text-on-surface-variant">Jobs in Progress</p>
            <p className="font-display-lg text-headline-md md:text-[48px] leading-none text-primary">
              {inProgress}
            </p>
          </div>
        </div>
        <div className="bg-surface border border-outline p-6 space-y-4 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="font-mono-label text-mono-label text-on-surface-variant opacity-60">[ID_02]</span>
            <span className="material-symbols-outlined text-secondary">monetization_on</span>
          </div>
          <div>
            <p className="font-mono-data text-mono-data uppercase text-on-surface-variant">Total GEN Earned</p>
            <div className="flex items-baseline gap-2">
              <p className="font-display-lg text-headline-md md:text-[48px] leading-none">
                {formatGen(totalEarned)}
              </p>
              <span className="font-mono-label text-mono-label text-secondary">GEN</span>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-outline p-6 space-y-4 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="font-mono-label text-mono-label text-on-surface-variant opacity-60">[ID_03]</span>
            <span className="material-symbols-outlined text-tertiary">verified_user</span>
          </div>
          <div>
            <p className="font-mono-data text-mono-data uppercase text-on-surface-variant">Protocol Reputation</p>
            {providerLoading ? (
              <span className="material-symbols-outlined text-3xl text-tertiary animate-spin inline-block">
                autorenew
              </span>
            ) : (
              <p className="font-display-lg text-headline-md md:text-[48px] leading-none text-tertiary">
                {provider ? `${provider.trustScore}%` : "--"}
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="bg-surface border border-outline overflow-hidden">
        <div className="px-6 py-4 border-b border-outline bg-surface-container-low flex justify-between items-center">
          <h2 className="font-mono-label text-mono-label uppercase tracking-widest text-on-surface">
            Live Delivery Ledger
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline bg-surface-container font-mono-data text-on-surface-variant text-[11px] uppercase tracking-tighter">
                <th className="px-6 py-3 font-medium">Job ID</th>
                <th className="px-6 py-3 font-medium">Modality</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Deadline</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-mono-data text-mono-data">
              {myDeliveries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant opacity-60">
                    No deliveries yet — accept a job from Browse Jobs to see it here.
                  </td>
                </tr>
              )}
              {myDeliveries.map((job) => (
                <tr key={job.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-bold text-on-surface">#{job.id}</td>
                  <td className="px-6 py-4 text-on-surface-variant opacity-70">{job.modality}</td>
                  <td className="px-6 py-4">
                    <span
                      className={
                        "px-2 py-0.5 border text-[10px] " +
                        (STATUS_STYLE[job.state] ?? "bg-surface-dim text-on-surface-variant border-outline")
                      }
                    >
                      {job.state.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant opacity-70 italic">
                    {job.deadline ?? "--:--:--"}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button
                      onClick={() => router.push(`/orders/${job.id}`)}
                      className="text-on-surface-variant hover:text-primary underline decoration-outline-variant"
                    >
                      DETAILS
                    </button>
                    {job.state === "Accepted" && (
                      <button
                        onClick={() => handleSubmitDelivery(job.id)}
                        disabled={delivering === job.id || isLocked(job.id, "deliver")}
                        className="bg-primary text-on-primary px-3 py-1 font-bold hover:bg-primary-container transition-all text-[11px] disabled:opacity-50"
                      >
                        {delivering === job.id || isLocked(job.id, "deliver") ? "GENERATING..." : "SUBMIT DELIVERY"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        <div className="bg-surface border border-outline p-6 space-y-4">
          <h3 className="font-mono-label text-mono-label text-primary uppercase flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">hub</span> Network Topology
          </h3>
          <div className="h-48 w-full border border-outline-variant relative overflow-hidden bg-surface-dim flex items-center justify-center">
            <div className="font-mono-data text-[10px] bg-surface/80 p-2 border border-outline">
              REAL_TIME_NODE_CONNECTIVITY_ACTIVE
            </div>
          </div>
        </div>
        <div className="bg-surface border border-outline p-6 space-y-4">
          <h3 className="font-mono-label text-mono-label text-primary uppercase flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">terminal</span> Operator Logs
          </h3>
          <div className="bg-on-surface p-4 h-48 overflow-y-auto font-mono-data text-[11px] text-secondary-fixed">
            <div className="opacity-50"># [SESSION_INIT] 2024-11-20 09:12:44</div>
            <div>&gt; AUTHENTICATING OPERATOR_082... OK</div>
            <div>&gt; FETCHING ESCROW_DATA... {myDeliveries.length} RECORDS FOUND</div>
            <div className="animate-pulse">&gt; _</div>
          </div>
        </div>
      </div>
    </div>
  );
}
