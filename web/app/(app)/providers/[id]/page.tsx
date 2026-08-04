"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useJobs, useProvider } from "@/lib/chain-client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatGen } from "@/lib/format";

export default function ProviderProfilePage() {
  const params = useParams<{ id: string }>();
  const { provider, loading, error } = useProvider(params.id);
  const { jobs, loading: jobsLoading } = useJobs();

  const history = useMemo(
    () => jobs.filter((j) => j.providerId?.toLowerCase() === params.id?.toLowerCase()),
    [jobs, params.id]
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <LoadingState fullPage label={`Reading provider ${params.id} from GenLayer Studio...`} />
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="flex-1 flex items-center justify-center py-32 flex-col gap-4">
        {error ? (
          <ErrorBanner message={error} />
        ) : (
          <p className="font-mono-label text-mono-label text-on-surface-variant">
            [404] PROVIDER "{params.id}" NOT REGISTERED ON-CHAIN
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-technical-lines flex-1 px-margin-mobile md:px-margin-desktop py-margin-desktop">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-outline">
            <div>
              <span className="font-mono-label text-mono-label text-on-surface-variant opacity-60">
                [PROVIDER_IDENTITY_CARD]
              </span>
              <h1 className="font-display-lg text-headline-lg-mobile md:text-display-lg uppercase tracking-tight text-on-surface mb-2">
                {provider.name}
              </h1>
              <div className="flex flex-wrap gap-4">
                <span className="font-mono-label text-mono-label bg-surface-container-high px-2 py-0.5 border border-outline">
                  ID: {provider.id}
                </span>
                <span className="font-mono-label text-mono-label text-secondary flex items-center gap-2 border border-secondary px-2 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-secondary" /> ACTIVE_ON_NETWORK
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <span className="font-mono-label text-mono-label text-on-surface-variant">
                [PROTOCOL_VERSION: 1.0.4]
              </span>
              <div className="flex gap-2">
                <button className="bg-primary text-on-primary font-mono-label text-mono-label px-6 py-3 border border-on-surface">
                  INITIATE_HIRE
                </button>
                <button className="bg-surface border border-on-surface font-mono-label text-mono-label px-6 py-3">
                  SEND_MESSAGE
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
          <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-gutter">
            <div className="bg-surface border border-outline p-6 flex flex-col justify-between">
              <div>
                <p className="font-mono-label text-mono-label text-on-surface-variant mb-4">
                  [01] JOBS_COMPLETED
                </p>
                <p className="font-display-lg text-headline-lg text-on-surface leading-none">
                  {provider.jobsCompleted}
                </p>
              </div>
              <div className="mt-8 h-2 w-full bg-surface-container-highest border border-outline overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "78%" }} />
              </div>
            </div>
            <div className="bg-surface border border-outline p-6 flex flex-col justify-between">
              <div>
                <p className="font-mono-label text-mono-label text-on-surface-variant mb-4">
                  [02] FULL_RELEASE_RATE
                </p>
                <p className="font-display-lg text-headline-lg text-secondary leading-none">
                  {provider.fullReleaseRate}%
                </p>
              </div>
              <p className="font-mono-data text-mono-data text-on-surface-variant mt-4">
                RELIABILITY_THRESHOLD: HIGH
              </p>
            </div>
            <div className="bg-surface border border-outline p-6 flex flex-col justify-between">
              <div>
                <p className="font-mono-label text-mono-label text-on-surface-variant mb-4">
                  [03] AVG_RELEASE_FRACTION
                </p>
                <p className="font-display-lg text-headline-lg text-on-surface leading-none">
                  {provider.avgReleaseFraction}
                </p>
              </div>
              <div className="mt-4 flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="w-full h-1 bg-secondary" />
                ))}
                <div className="w-full h-1 bg-surface-container-highest" />
              </div>
            </div>
            <div className="bg-surface border border-outline p-6 flex flex-col justify-between">
              <div>
                <p className="font-mono-label text-mono-label text-on-surface-variant mb-4">[04] ACTIVE_JOBS</p>
                <p className="font-display-lg text-headline-lg text-primary leading-none">
                  {String(provider.activeJobs).padStart(2, "0")}
                </p>
              </div>
              <p className="font-mono-data text-mono-data text-on-surface-variant mt-4">
                MAX_CAPACITY: {String(provider.maxCapacity).padStart(2, "0")}
              </p>
            </div>
          </div>

          <div className="md:col-span-4 border border-outline bg-surface-container p-6">
            <p className="font-mono-label text-mono-label text-on-surface-variant border-b border-outline pb-4 mb-6 uppercase">
              Operating_Modalities
            </p>
            <div className="space-y-6">
              {provider.modalities.map((m) => (
                <div key={m.label} className="flex items-center gap-4">
                  <div className="w-12 h-12 border border-outline flex items-center justify-center bg-surface">
                    <span className="material-symbols-outlined text-primary">{m.icon}</span>
                  </div>
                  <div>
                    <p className="font-mono-label text-mono-label font-bold">{m.label}</p>
                    <p className="font-mono-data text-mono-data text-on-surface-variant">{m.detail}</p>
                  </div>
                </div>
              ))}
              <div className="pt-6 border-t border-outline mt-8">
                <p className="font-mono-data text-mono-data text-on-surface-variant mb-4 uppercase">
                  Node_Hardware_Ref
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between font-mono-data text-mono-data">
                    <span className="text-on-surface-variant">Uptime_Metric</span>
                    <span className="text-secondary">{provider.uptime}</span>
                  </div>
                  <div className="flex justify-between font-mono-data text-mono-data">
                    <span className="text-on-surface-variant">Latency_AVG</span>
                    <span>{provider.latency}</span>
                  </div>
                  <div className="flex justify-between font-mono-data text-mono-data">
                    <span className="text-on-surface-variant">Region_Zone</span>
                    <span>{provider.region}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-12">
          <h3 className="font-mono-label text-mono-label mb-6 flex items-center gap-2">
            <span className="w-3 h-[1px] bg-primary" /> [TRANSACTION_HISTORY_LEDGER]
          </h3>
          <div className="border border-outline bg-surface overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high border-b border-outline">
                  <th className="p-4 font-mono-label text-mono-label text-on-surface-variant">#ID</th>
                  <th className="p-4 font-mono-label text-mono-label text-on-surface-variant">MODALITY</th>
                  <th className="p-4 font-mono-label text-mono-label text-on-surface-variant">STATUS</th>
                  <th className="p-4 font-mono-label text-mono-label text-on-surface-variant">ESCROW_VAL</th>
                  <th className="p-4 font-mono-label text-mono-label text-on-surface-variant text-right">
                    SETTLEMENT
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono-data text-mono-data divide-y divide-outline">
                {jobsLoading && (
                  <tr>
                    <td className="p-4" colSpan={5}>
                      <LoadingState label="Reading transaction history from GenLayer Studio..." />
                    </td>
                  </tr>
                )}
                {!jobsLoading && history.length === 0 && (
                  <tr>
                    <td className="p-4 text-on-surface-variant" colSpan={5}>
                      No jobs accepted by this provider yet.
                    </td>
                  </tr>
                )}
                {history.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-4">#{job.id}</td>
                    <td className="p-4">{job.modality}</td>
                    <td className="p-4">
                      <span
                        className={
                          job.state === "Released" ? "text-secondary font-bold" : "text-primary font-bold"
                        }
                      >
                        {job.state.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">{formatGen(job.rewardGen)} GEN</td>
                    <td className="p-4 text-right">
                      {job.releaseFraction !== undefined ? `${Math.round(job.releaseFraction * 100)}%` : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
