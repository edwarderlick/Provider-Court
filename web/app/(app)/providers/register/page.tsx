"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { LoadingState } from "@/components/LoadingState";
import { addProviderModality, registerProvider, useProvider } from "@/lib/chain-client";
import { useAppState } from "@/lib/store";
import { acquireLock, isLocked, releaseLock } from "@/lib/tx-lock";
import { ErrorBanner } from "@/components/ErrorBanner";
import { InlineSpinner } from "@/components/InlineSpinner";

const MODALITIES = [
  { icon: "article", label: "TEXT_LLM", value: "TEXT" },
  { icon: "image", label: "IMAGE_GEN", value: "IMAGE" },
  { icon: "audio_file", label: "AUDIO_SYNTH", value: "AUDIO" },
];

export default function ProviderRegistrationPage() {
  const router = useRouter();
  const { wallet } = useAppState();
  // register_provider is create-only -- it rejects ANY second call from an
  // already-registered wallet regardless of which modality is requested
  // ("provider already registered"), which is a different thing from that
  // modality specifically being unregistered. Detecting the wallet's
  // existing registration here lets this page switch to the separate
  // add_modality path instead of retrying the same call that will always
  // fail for an already-registered wallet.
  const { provider: existingProvider, loading: loadingExisting, refetch: refetchExisting } = useProvider(
    wallet.address ?? undefined
  );
  const alreadyRegisteredModalities: string[] = existingProvider
    ? existingProvider.modalities.map((m) => m.label.split("_")[0])
    : [];
  const isAlreadyRegistered = Boolean(existingProvider);

  const [selected, setSelected] = useState<string[]>(["TEXT"]);
  const newlySelectedModalities = selected.filter((v) => !alreadyRegisteredModalities.includes(v));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Per-iteration feedback for the add_modality loop below -- e.g.
  // "Registering modality 2 of 3 (AUDIO)..." instead of one static
  // "SUBMITTING..." for the whole multi-transaction stretch.
  const [modalityProgress, setModalityProgress] = useState<{ index: number; total: number; modality: string } | null>(
    null
  );
  const lockKey = wallet.address ?? "anon";

  // Once we know which modalities (if any) this wallet already has, default
  // the selection to whatever's newly addable rather than re-offering
  // modalities it's already registered for.
  useEffect(() => {
    if (loadingExisting) return;
    if (isAlreadyRegistered) {
      const firstUnregistered = MODALITIES.find((m) => !alreadyRegisteredModalities.includes(m.value));
      setSelected(firstUnregistered ? [firstUnregistered.value] : []);
    }
  }, [loadingExisting, isAlreadyRegistered, existingProvider]);

  function toggle(value: string) {
    if (alreadyRegisteredModalities.includes(value)) return;
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function completeRegistration() {
    if (isLocked(lockKey, "register")) {
      setSubmitError("A registration for this wallet is already in progress -- please wait for it to finalize.");
      return;
    }
    acquireLock(lockKey, "register");
    setSubmitting(true);
    setSubmitError(null);
    setModalityProgress(null);
    try {
      if (isAlreadyRegistered) {
        // add_modality only takes one modality per call -- sign one
        // transaction per newly selected modality, in sequence. Filtered
        // defensively even though toggle() already blocks re-selecting an
        // already-registered modality.
        const newModalities = selected.filter((v) => !alreadyRegisteredModalities.includes(v));
        let address = wallet.address!;
        for (let i = 0; i < newModalities.length; i++) {
          const modality = newModalities[i];
          setModalityProgress({ index: i + 1, total: newModalities.length, modality });
          const result = await addProviderModality(wallet, modality as "TEXT" | "IMAGE" | "AUDIO");
          address = result.address;
        }
        await refetchExisting();
        releaseLock(lockKey, "register");
        setConfirmOpen(false);
        router.push(`/providers/${address}`);
        return;
      }
      const { address } = await registerProvider(wallet, selected as ("TEXT" | "IMAGE" | "AUDIO")[]);
      releaseLock(lockKey, "register");
      setConfirmOpen(false);
      router.push(`/providers/${address}`);
    } catch (err) {
      setSubmitError((err as Error).message);
      releaseLock(lockKey, "register");
    } finally {
      setSubmitting(false);
      setModalityProgress(null);
    }
  }

  return (
    <div className="grid-bg min-h-screen px-margin-mobile md:px-margin-desktop pb-16">
      <div className="max-w-4xl mx-auto py-margin-desktop">
        <header className="mb-12 border-l-4 border-primary pl-6">
          <div className="font-mono-data text-mono-data text-primary mb-1 uppercase tracking-widest">
            [ SYSTEM_MESSAGE: INITIALIZING_NODE_IDENTIFICATION ]
          </div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tighter">
            PROVIDER_REGISTRATION
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <span className="font-mono-label text-mono-label text-on-surface-variant bg-surface-container px-2 py-0.5 border border-outline">
              AUTH_LEVEL: 01
            </span>
            <span className="font-mono-label text-mono-label text-on-surface-variant bg-surface-container px-2 py-0.5 border border-outline">
              REF_ID: REG-01
            </span>
            <span className="flex items-center gap-2 text-secondary font-mono-label text-mono-label">
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
              NETWORK_LINK_STABLE
            </span>
          </div>
        </header>

        {loadingExisting && wallet.address && (
          <div className="mb-8">
            <LoadingState label="Checking this wallet's existing registration on GenLayer Studio..." />
          </div>
        )}

        <div className="bg-surface border border-outline relative overflow-hidden shadow-sm">
          <div className="scanline" />
          <div className="bg-surface-container-highest border-b border-outline px-4 py-2 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-primary text-sm">terminal</span>
              <span className="font-mono-label text-mono-label text-on-surface-variant">
                REGISTRATION_MODULE.EXE
              </span>
            </div>
            <div className="flex gap-2">
              <div className="w-3 h-3 border border-outline" />
              <div className="w-3 h-3 border border-outline" />
              <div className="w-3 h-3 bg-primary" />
            </div>
          </div>

          <form
            className="p-6 md:p-8 space-y-10"
            onSubmit={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-4">
                <h3 className="font-mono-label text-mono-label text-primary">[01] DISPLAY_NAME</h3>
                <p className="font-mono-data text-mono-data text-on-surface-variant mt-2 leading-relaxed">
                  The public identifier for your node. This will be visible to seekers during the bidding
                  process.
                </p>
              </div>
              <div className="md:col-span-8">
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-low border border-outline font-mono-label text-mono-label p-4 focus:ring-0 focus:border-primary transition-all"
                    placeholder="e.g., NEURAL_LINK_DELTA"
                    type="text"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 font-mono-data text-[10px] text-outline">
                    CHAR_LIMIT: 32
                  </div>
                </div>
              </div>
            </section>

            <div className="h-px bg-outline-variant w-full" />

            <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-4">
                <h3 className="font-mono-label text-mono-label text-primary">[02] MODALITY_SUPPORT</h3>
                <p className="font-mono-data text-mono-data text-on-surface-variant mt-2 leading-relaxed">
                  {isAlreadyRegistered
                    ? "This wallet is already registered. Modalities you already have are locked below -- select any additional ones to add them to your existing registration."
                    : "Select which job types your wallet is eligible to accept. Generation for accepted jobs runs through Provider Court's shared model backend -- you do not bring your own API key, model, or hardware."}
                </p>
              </div>
              <div className="md:col-span-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {MODALITIES.map((m) => {
                    const alreadyHave = alreadyRegisteredModalities.includes(m.value);
                    const checked = alreadyHave || selected.includes(m.value);
                    return (
                      <label
                        key={m.value}
                        className={
                          "group border p-4 transition-colors relative " +
                          (alreadyHave
                            ? "border-secondary bg-secondary/10 cursor-default"
                            : "cursor-pointer hover:bg-surface-container-high " +
                              (checked ? "border-primary bg-primary/10" : "border-outline"))
                        }
                      >
                        <input
                          className="absolute opacity-0"
                          name="modality"
                          type="checkbox"
                          checked={checked}
                          disabled={alreadyHave}
                          onChange={() => toggle(m.value)}
                        />
                        <div className="flex flex-col items-center gap-3">
                          <span
                            className={
                              "material-symbols-outlined transition-transform " +
                              (alreadyHave ? "text-secondary" : "text-primary group-hover:scale-110")
                            }
                          >
                            {m.icon}
                          </span>
                          <span className="font-mono-label text-mono-label">{m.label}</span>
                          {alreadyHave ? (
                            <span className="font-mono-data text-[10px] text-secondary uppercase">
                              already registered
                            </span>
                          ) : (
                            <div
                              className={
                                "w-4 h-4 border border-outline flex items-center justify-center " +
                                (checked ? "bg-primary" : "")
                              }
                            >
                              {checked && (
                                <span className="material-symbols-outlined text-[10px] text-on-primary">
                                  check
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="h-px bg-outline-variant w-full" />

            <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-4">
                <h3 className="font-mono-label text-mono-label text-primary">[03] GENERATION_BACKEND</h3>
                <p className="font-mono-data text-mono-data text-on-surface-variant mt-2 leading-relaxed">
                  How accepted jobs actually get generated.
                </p>
              </div>
              <div className="md:col-span-8">
                <div className="border border-outline-variant bg-surface-container-low p-4">
                  <p className="font-mono-data text-mono-data text-on-surface-variant leading-relaxed">
                    Provider Court runs one shared generation backend (Gemini / Cloudflare Workers AI / IPFS
                    pinning) for every accepted job, regardless of whose wallet accepted it. Registering does
                    not require -- and currently has no way to submit -- your own API key, model, or
                    infrastructure. Your wallet only needs to sign the on-chain accept/deliver transactions;
                    generation happens automatically behind the scenes.
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-surface-container p-6 border border-outline-variant">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex flex-col gap-1">
                  <span className="font-mono-data text-mono-data text-on-surface-variant uppercase">
                    [ ESTIMATED_REGISTRATION_COST ]
                  </span>
                  <span className="font-headline-md text-headline-md text-primary tracking-tighter">
                    0 GEN
                  </span>
                  <span className="font-mono-data text-[10px] text-outline italic">
                    GenLayer Studio is gasless -- registration only requires the modalities below
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={isAlreadyRegistered ? newlySelectedModalities.length === 0 : selected.length === 0}
                  className="w-full md:w-auto bg-primary text-on-primary px-10 py-5 font-mono-label text-mono-label border-2 border-primary hover:bg-on-primary-fixed-variant transition-all flex items-center justify-center gap-3 active:translate-y-1 shadow-[4px_4px_0px_#3a0b00] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">send_and_archive</span>
                  {isAlreadyRegistered ? "ADD MODALITY" : "INITIATE REGISTRATION"}
                </button>
              </div>
            </section>
          </form>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-outline bg-surface-container-low p-4 flex gap-4">
            <span className="material-symbols-outlined text-primary">gavel</span>
            <div>
              <h4 className="font-mono-label text-mono-label text-on-surface">[DISPUTE_RESOLUTION]</h4>
              <p className="font-mono-data text-mono-data text-on-surface-variant mt-1 leading-normal">
                Registration itself is free -- no bond required. Delivered work is judged after the fact by
                the Provider Court Jury (real GenVM validator consensus against each job&apos;s clauses).
              </p>
            </div>
          </div>
          <div className="border border-outline bg-surface-container-low p-4 flex gap-4">
            <span className="material-symbols-outlined text-primary">security</span>
            <div>
              <h4 className="font-mono-label text-mono-label text-on-surface">[SHARED_BACKEND]</h4>
              <p className="font-mono-data text-mono-data text-on-surface-variant mt-1 leading-normal">
                Only your wallet address and chosen modalities go on-chain. Content generation is handled by
                Provider Court&apos;s shared backend, not infrastructure you provide.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        tag="[03]"
        title={isAlreadyRegistered ? "CONFIRM_ADD_MODALITY" : "CONFIRM_REGISTRATION"}
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-6 py-3 border border-outline font-mono-label text-mono-label hover:bg-surface-container-high transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={completeRegistration}
              disabled={submitting || isLocked(lockKey, "register")}
              className="px-6 py-3 bg-primary text-on-primary font-mono-label text-mono-label hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting || isLocked(lockKey, "register") ? (
                <>
                  <InlineSpinner /> SUBMITTING...
                </>
              ) : (
                "SIGN & SUBMIT"
              )}
            </button>
          </>
        }
      >
        {isAlreadyRegistered ? (
          <p className="font-mono-data text-mono-data text-on-surface-variant leading-relaxed">
            This wallet is already registered for{" "}
            <span className="text-secondary font-bold">{alreadyRegisteredModalities.join(", ")}</span>. This
            adds{" "}
            <span className="text-primary font-bold">
              {newlySelectedModalities.join(", ") || "none selected"}
            </span>{" "}
            to that registration -- one transaction per new modality, all signed by this same wallet.
          </p>
        ) : (
          <p className="font-mono-data text-mono-data text-on-surface-variant leading-relaxed">
            This registers your provider identity on-chain with modalities:{" "}
            <span className="text-primary font-bold">{selected.join(", ") || "none selected"}</span>. This
            submits a real transaction to the GenLayer Studio contract.
          </p>
        )}
        {modalityProgress && (
          <p className="font-mono-data text-mono-data text-primary mt-4 flex items-center gap-2">
            <InlineSpinner />
            <span>
              Registering modality {modalityProgress.index} of {modalityProgress.total} (
              {modalityProgress.modality})...
            </span>
          </p>
        )}
        {submitError && (
          <div className="mt-4">
            <ErrorBanner message={submitError} />
          </div>
        )}
      </Modal>
    </div>
  );
}
