"use client";

import { useEffect, useRef, useState } from "react";
import { JobModality } from "@/lib/types";

// Generous ceiling for a single gateway fetch attempt -- exists so a
// request that never resolves (confirmed directly: backgrounding the tab
// mid-fetch can leave one hanging with no response ever arriving) doesn't
// leave TextArtifact stuck on "Loading delivered content..." forever with
// no way out. Pinata gateway reads are normally fast (well under a
// second for the small text payloads this delivers); 15s is well past
// that while still being far short of "the user gave up and moved on."
const TEXT_FETCH_TIMEOUT_MS = 15000;

// Renders the actual delivered artifact inline, keyed off modality, rather
// than a "download it yourself" link. Only needs a cid to exist (set at
// submit_delivery, i.e. STATE_DELIVERED) -- deliberately independent of
// whether adjudication has run yet, so a buyer can see what they got
// regardless of the verdict (see the order page's usage: this renders
// starting at the Delivered state, not gated behind Adjudicating/Released).
export function ArtifactViewer({
  modality,
  gatewayUrl,
}: {
  modality: JobModality;
  gatewayUrl: string;
}) {
  if (modality === "IMAGE") {
    return (
      <div className="border border-outline-variant bg-surface-container-low p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- external gateway URL, not a local/optimizable asset */}
        <img
          src={gatewayUrl}
          alt="Delivered artifact"
          className="max-w-full h-auto mx-auto block"
        />
      </div>
    );
  }

  if (modality === "AUDIO") {
    return (
      <div className="border border-outline-variant bg-surface-container-low p-4">
        <audio controls src={gatewayUrl} className="w-full" />
      </div>
    );
  }

  return <TextArtifact gatewayUrl={gatewayUrl} />;
}

// TEXT delivery is never stored on the Order itself -- only its cid/gatewayUrl
// are -- so the actual content has to be fetched client-side from the
// gateway. Both gateway.pinata.cloud and a raw data: URI (see genlayer-server
// .ts's gatewayUrlFor) are same-origin-safe to fetch: the Pinata gateway
// sends `Access-Control-Allow-Origin: *` (confirmed directly against a real
// delivered CID), and data: URIs have no origin to be blocked by.
function TextArtifact({ gatewayUrl }: { gatewayUrl: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tracks whether THIS gatewayUrl has ever actually settled (success or
  // real error) -- lets the visibility-retry below tell "still waiting,
  // possibly stuck" apart from "already showing something real," so it
  // only ever fires a fresh attempt when there's actually nothing to lose,
  // never replacing already-loaded content with a spinner on every refocus.
  const settledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let currentController: AbortController | null = null;
    settledRef.current = false;

    function load() {
      // A refocus-triggered retry always supersedes whatever attempt came
      // before -- abort it rather than letting two requests race, and
      // rather than trusting the original one to ever actually resolve.
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;
      const timeoutId = setTimeout(() => controller.abort(), TEXT_FETCH_TIMEOUT_MS);
      setText(null);
      setError(null);
      fetch(gatewayUrl, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`gateway returned ${res.status}`);
          return res.text();
        })
        .then((body) => {
          if (cancelled) return;
          settledRef.current = true;
          setText(body);
        })
        .catch((err) => {
          if (cancelled) return;
          // Superseded by a newer attempt, or our own timeout fired because
          // the original request genuinely never came back -- either way,
          // the visibility handler below (or a fresh mount) owns recovery
          // from here, not a hard error shown to the user.
          if ((err as Error).name === "AbortError") return;
          settledRef.current = true;
          setError((err as Error).message);
        })
        .finally(() => clearTimeout(timeoutId));
    }

    load();

    function onVisible() {
      if (document.visibilityState === "visible" && !settledRef.current) {
        load();
      }
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      currentController?.abort();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [gatewayUrl]);

  if (error) {
    return (
      <div className="border border-error bg-surface-container-low p-4">
        <p className="font-mono-data text-mono-data text-error">
          [ERROR] Could not load delivered content: {error}
        </p>
        <a
          href={gatewayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono-label text-mono-label text-primary hover:underline"
        >
          Open directly instead
        </a>
      </div>
    );
  }

  if (text === null) {
    return (
      <div className="border border-outline-variant bg-surface-container-low p-4">
        <p className="font-mono-data text-mono-data text-on-surface-variant">Loading delivered content...</p>
      </div>
    );
  }

  return (
    <div className="border border-outline-variant bg-surface-container-low p-4 max-h-96 overflow-y-auto">
      <pre className="font-mono-data text-sm whitespace-pre-wrap break-words">{text}</pre>
    </div>
  );
}
