"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ErrorBanner } from "@/components/ErrorBanner";
import { InlineSpinner } from "@/components/InlineSpinner";
import { CreateListingProgress, DerivedClause, createListing, deriveClauses } from "@/lib/chain-client";
import { useAppState } from "@/lib/store";
import { acquireLock, isLocked, releaseLock } from "@/lib/tx-lock";
import { JobModality } from "@/lib/types";
import { formatGen } from "@/lib/format";

function parseTtlToSeconds(ttl: string): number {
  const match = ttl.trim().match(/^(\d+)\s*([hm])$/i);
  if (!match) return 3600;
  const amount = Number(match[1]);
  return match[2].toLowerCase() === "h" ? amount * 3600 : amount * 60;
}

// Real example, not decorative: an actual AUDIO listing on this contract read
// "Ask me any audio or song remix, i could do it" -- the only audio model
// wired up (Cloudflare Workers AI's MeloTTS) is text-to-speech only, no
// music/melody capability at all, so a buyer who took that literally got a
// spoken-word reading of their own request back instead of a song. See
// contract/README.md's "AUDIO capability" section for the full investigation
// (real music-generation models exist in Cloudflare's catalog now, but are
// third-party/BYOK entries reachable only via a separate paid provider
// account, not this project's existing free Workers AI setup -- confirmed
// directly, not assumed). The description placeholder below is deliberately
// modality-aware so a provider selecting AUDIO sees a realistic example
// instead of an image-oriented one that gives no real guidance.
const DESCRIPTION_PLACEHOLDER: Record<JobModality, string> = {
  TEXT: "What are you offering? e.g. Anime-style character portraits",
  IMAGE: "What are you offering? e.g. Anime-style character portraits",
  AUDIO: "What are you offering? e.g. Voiceover narration read aloud in a clear, professional voice",
};

const PROGRESS_LABEL: Record<CreateListingProgress, string> = {
  "awaiting-listing-signature": "Waiting for you to confirm listing creation in your wallet...",
  "finalizing-listing": "Listing submitted -- waiting for GenVM consensus to finalize (typically 10-60s)...",
};

// Clause authoring is gone entirely -- a provider now only writes a plain
// description. Every listing still gets real clauses underneath: a fixed
// baseline modality-integrity check the contract itself always adds (never
// shown here as editable, since it's identical every time and never
// derived from anything), plus 1-2 content clauses auto-derived from this
// description via the shared backend's LLM derivation step. "Review &
// List" triggers that derivation once and shows the result read-only, so
// the provider can see exactly what will be checked without ever typing a
// clause by hand.
export default function ListServicePage() {
  const router = useRouter();
  const { wallet } = useAppState();
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<CreateListingProgress | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [modality, setModality] = useState<JobModality>("TEXT");
  const [price, setPrice] = useState(0.75);
  const [deliverWindow, setDeliverWindow] = useState("24h");
  const [requiresInput, setRequiresInput] = useState(false);
  const [inputHint, setInputHint] = useState("");

  const [reviewOpen, setReviewOpen] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [derivedClauses, setDerivedClauses] = useState<DerivedClause[] | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);

  async function handleReview() {
    setDeriving(true);
    setDeriveError(null);
    try {
      // guaranteeFallback=true: a listing always needs at least one content
      // clause on-chain, so this never comes back empty even if the LLM
      // call itself fails -- worst case is a generic fallback clause, not a
      // blocked listing.
      const clauses = await deriveClauses(modality, description, 2, { guaranteeFallback: true });
      setDerivedClauses(clauses);
      setReviewOpen(true);
    } catch (err) {
      setDeriveError((err as Error).message);
    } finally {
      setDeriving(false);
    }
  }

  // No listing id exists until this call finalizes, so the lock is keyed by
  // wallet address instead -- same purpose as tx-lock's job/order-id keys:
  // survive a remount (navigate away mid-wait, come back) so a second real
  // create_listing transaction can't be fired while the first is still
  // finalizing (real observed latency 10-90s, same as create_job).
  const lockKey = wallet.address ?? "anon";

  async function confirmAndList() {
    if (isLocked(lockKey, "create-listing")) {
      setSubmitError("A listing creation for this wallet is already in progress -- please wait for it to finalize.");
      return;
    }
    acquireLock(lockKey, "create-listing");
    setSubmitting(true);
    setSubmitError(null);
    setProgress(null);
    try {
      const { listingId } = await createListing(
        wallet,
        {
          modality,
          description,
          contentClauses: derivedClauses ?? [],
          priceGen: price,
          deliverWindowSeconds: parseTtlToSeconds(deliverWindow),
          requiresInput,
          inputHint: requiresInput ? inputHint : "",
        },
        setProgress
      );
      releaseLock(lockKey, "create-listing");
      setReviewOpen(false);
      router.push(`/listings/browse`);
    } catch (err) {
      setSubmitError((err as Error).message);
      releaseLock(lockKey, "create-listing");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="bg-technical-lines flex-1 px-margin-mobile md:px-margin-desktop py-margin-desktop">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-baseline mb-12 border-b border-outline-variant pb-6 gap-4">
          <div>
            <span className="font-mono-data text-mono-data text-primary">[STEP 03]</span>
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg tracking-tighter">
              LIST A SERVICE
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Describe your own delivery standard once -- every purchase is checked against it
              automatically. No clause form to fill out: the checks are generated for you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-label text-mono-label opacity-40">AUTO-SAVE: ON</span>
            <div className="w-2 h-2 bg-secondary" />
          </div>
        </div>

        <div className="mb-8 border border-outline-variant bg-surface-container-low p-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-mono-label text-[11px] text-on-surface-variant opacity-70">DESCRIPTION</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={DESCRIPTION_PLACEHOLDER[modality]}
              className="bg-surface border border-outline p-2 font-mono-data text-sm focus:border-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono-label text-[11px] text-on-surface-variant opacity-70">MODALITY</span>
            <select
              value={modality}
              onChange={(e) => setModality(e.target.value as JobModality)}
              className="bg-surface border border-outline p-2 font-mono-data text-sm rounded-none"
            >
              <option value="TEXT">TEXT</option>
              <option value="IMAGE">IMAGE</option>
              <option value="AUDIO">AUDIO</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono-label text-[11px] text-on-surface-variant opacity-70">PRICE (GEN)</span>
            <input
              type="number"
              value={price}
              min={0.05}
              max={2}
              step={0.05}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="bg-surface border border-outline p-2 font-mono-data text-sm focus:border-primary outline-none"
            />
          </label>
        </div>

        {modality === "AUDIO" && (
          <div className="mb-4 border border-primary bg-primary-container/10 p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary">record_voice_over</span>
              <div>
                <span className="font-mono-label text-[11px] text-primary block">
                  AUDIO = TEXT-TO-SPEECH ONLY
                </span>
                <p className="font-mono-data text-[10px] text-on-surface-variant opacity-70 mt-1">
                  The audio model behind this listing reads text aloud in a spoken voice --
                  narration, voiceovers, announcements. It cannot compose music, songs, or
                  melodies of any kind. Describe your service in those terms so buyers know
                  what they'll actually receive.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="border border-outline-variant bg-surface-container-low p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary">auto_awesome</span>
            <div>
              <span className="font-mono-label text-[11px] text-on-surface-variant block">
                CLAUSES ARE GENERATED AUTOMATICALLY
              </span>
              <p className="font-mono-data text-[10px] text-on-surface-variant opacity-70 mt-1">
                {modality === "TEXT" ? (
                  <>
                    Every order automatically gets a baseline check confirming the delivered content
                    is genuinely {modality} (always included, never editable) plus 1-2 real checks
                    derived from your description above. Click "Review & List" below to see the exact
                    checks before you commit -- nothing is hidden, there's just no form to fill out.
                  </>
                ) : (
                  <>
                    Every order automatically gets a baseline check confirming the delivered content
                    is genuine, non-empty {modality.toLowerCase()} data (always included, never
                    editable). {modality} content isn't checked against your description beyond
                    that: adjudication only ever sees raw file bytes, not the actual picture or
                    sound, so a claim like "must mention X" can't honestly be verified for this
                    modality -- it would just fail correct deliveries at random. Click "Review &
                    List" below to see the exact check before you commit.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 border border-outline-variant bg-surface-container-low p-4">
          <label className="flex flex-col gap-1 max-w-xs">
            <span className="font-mono-label text-[11px] text-on-surface-variant opacity-70">
              DELIVERY WINDOW (per order)
            </span>
            <input
              value={deliverWindow}
              onChange={(e) => setDeliverWindow(e.target.value)}
              placeholder="e.g. 24h or 30m"
              className="bg-surface border border-outline p-2 font-mono-data text-sm focus:border-primary outline-none"
            />
          </label>
          <p className="font-mono-data text-[10px] text-on-surface-variant mt-2">
            How long the automatic pipeline has to generate, deliver, and adjudicate each individual purchase
            of this listing before it's considered missed.
          </p>
        </div>

        <div className="mt-4 border border-outline-variant bg-surface-container-low p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={requiresInput}
              onChange={(e) => setRequiresInput(e.target.checked)}
              className="mt-1 w-4 h-4 accent-primary"
            />
            <span>
              <span className="font-mono-label text-[11px] text-on-surface-variant block">
                SUGGESTS BUYER INPUT
              </span>
              <span className="font-mono-data text-[10px] text-on-surface-variant opacity-70">
                Check this if your description alone isn't enough to generate from -- e.g. you're
                offering a template and the buyer needs to supply the actual content (a character
                description, a topic, etc). Every buyer always sees an optional input field at
                checkout regardless -- checking this just shows them your hint text below so they
                know what to add. It's guidance only, not a requirement enforced on-chain: a buyer
                can still leave it blank if they choose to. When they don't leave it blank, their
                text also becomes its own real clause, on top of the ones derived from your
                description here.
              </span>
            </span>
          </label>
          {requiresInput && (
            <label className="flex flex-col gap-1 mt-3">
              <span className="font-mono-label text-[11px] text-on-surface-variant opacity-70">
                HINT SHOWN TO BUYER
              </span>
              <input
                value={inputHint}
                onChange={(e) => setInputHint(e.target.value)}
                placeholder='e.g. "Describe the character you want (appearance, pose, style)"'
                className="bg-surface border border-outline p-2 font-mono-data text-sm focus:border-primary outline-none"
              />
            </label>
          )}
        </div>

        {deriveError && (
          <div className="mt-4">
            <ErrorBanner message={deriveError} />
          </div>
        )}
      </div>

      <footer className="max-w-4xl mx-auto mt-16 border-t-2 border-outline bg-surface-container-lowest grid grid-cols-12 gap-gutter px-6 py-8 items-center">
        <div className="col-span-12 md:col-span-6 flex items-center gap-4">
          <div className="bg-primary-container/10 p-2 border border-primary">
            <span className="material-symbols-outlined text-primary">info</span>
          </div>
          <div>
            <span className="font-mono-data text-mono-data uppercase block text-primary font-bold">
              [INFO] VALIDATION SUMMARY
            </span>
            <span className="font-mono-data text-mono-data text-on-surface-variant">
              Full payment requires the baseline check plus every auto-derived clause to pass.
            </span>
          </div>
        </div>
        <div className="col-span-12 md:col-span-6 flex justify-end gap-gutter">
          <button
            onClick={handleReview}
            disabled={!description.trim() || deriving}
            className="px-8 py-3 bg-primary text-white font-mono-label text-mono-label uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {deriving ? (
              <>
                <InlineSpinner /> Analyzing description...
              </>
            ) : (
              <>
                Review & List
                <span className="material-symbols-outlined ml-2">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </footer>

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        tag="[04]"
        title="REVIEW_&amp;_LIST"
        footer={
          <>
            <button
              onClick={() => setReviewOpen(false)}
              className="px-6 py-3 border border-outline font-mono-label text-mono-label hover:bg-surface-container-high transition-colors"
            >
              BACK
            </button>
            <button
              onClick={confirmAndList}
              disabled={submitting || isLocked(lockKey, "create-listing")}
              className="px-6 py-3 bg-primary text-on-primary font-mono-label text-mono-label hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting || isLocked(lockKey, "create-listing") ? (
                <>
                  <InlineSpinner /> SUBMITTING...
                </>
              ) : (
                `LIST AT ${formatGen(price)} GEN`
              )}
            </button>
          </>
        }
      >
        {progress && (
          <p className="font-mono-data text-mono-data text-primary mb-4 leading-relaxed">
            {PROGRESS_LABEL[progress]}
          </p>
        )}
        <div className="space-y-2 font-mono-data text-mono-data">
          <div className="flex justify-between border-b border-outline-variant py-2">
            <span className="text-on-surface-variant">DESCRIPTION</span>
            <span>{description}</span>
          </div>
          <div className="flex justify-between border-b border-outline-variant py-2">
            <span className="text-on-surface-variant">MODALITY</span>
            <span>{modality}</span>
          </div>
          <div className="border-b border-outline-variant py-2">
            <span className="text-on-surface-variant block mb-2">CLAUSES (AUTO-GENERATED)</span>
            <div className="pl-3 space-y-1">
              <div className="text-[11px] text-secondary">
                [BASELINE] Genuine {modality} content delivered (always included)
              </div>
              {(derivedClauses ?? []).map((c, i) => (
                <div key={i} className="text-[11px] text-primary">
                  [{c.type.toUpperCase()}] {c.value} (weight {c.weight})
                </div>
              ))}
              {modality !== "TEXT" && (derivedClauses ?? []).length === 0 && (
                <div className="text-[11px] text-on-surface-variant opacity-70 italic">
                  No content clauses for {modality} -- adjudication can't check binary content
                  against your description, so only the baseline check above applies.
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between border-b border-outline-variant py-2">
            <span className="text-on-surface-variant">SUGGESTS BUYER INPUT</span>
            <span>{requiresInput ? "YES" : "NO"}</span>
          </div>
          <div className="flex justify-between py-2 text-primary font-bold">
            <span>PRICE PER ORDER</span>
            <span>{formatGen(price)} GEN</span>
          </div>
        </div>
        {submitError && (
          <div className="mt-4">
            <ErrorBanner message={submitError} />
          </div>
        )}
      </Modal>
    </div>
  );
}
