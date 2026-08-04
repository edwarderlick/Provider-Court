"use client";

import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/lib/store";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Shared by both places the app shows the connected wallet (the top-nav
// chip and the sidebar identity block) -- previously each rendered its own
// ad-hoc connected-state UI, and the top-nav one wired a single click
// straight to disconnectWallet, too easy to trigger by accident. Now a
// click only ever opens this popover; disconnecting requires a second,
// deliberate click on the button inside it. Styled to match the app's
// existing surfaces (hardware-border card, mono fonts, primary/error
// button treatment) rather than introducing a new visual pattern -- there
// was no existing anchored-popover component to reuse, only the centered
// Modal, which doesn't fit a small anchored menu like this.
export function ConnectedWalletMenu({
  align = "right",
  variant = "chip",
  className,
}: {
  align?: "left" | "right";
  // "chip" matches the top-nav's existing pill-button treatment. "text"
  // is a bare truncated-address trigger for the sidebar identity block,
  // which already has its own icon/avatar and status line around it --
  // wrapping that in a second icon+pill would just look like a button
  // nested inside a button-shaped row.
  variant?: "chip" | "text";
  className?: string;
}) {
  const { wallet, disconnectWallet } = useAppState();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (wallet.status !== "connected" || !wallet.address) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(wallet.address!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied/unavailable -- not worth surfacing
      // as an error, the full address is already shown to copy by hand.
    }
  }

  function handleDisconnect() {
    setOpen(false);
    disconnectWallet();
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      {variant === "chip" ? (
        <button
          onClick={() => setOpen((o) => !o)}
          className="machine-border px-4 py-1.5 flex items-center gap-2 bg-surface-container-highest hover:bg-surface-container-high transition-colors w-full"
          title="Wallet options"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            account_balance_wallet
          </span>
          <span className="font-mono-data text-mono-data truncate">{shortenAddress(wallet.address)}</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className="font-mono-label text-mono-label font-bold text-primary hover:underline truncate max-w-full text-left"
          title="Wallet options"
        >
          {shortenAddress(wallet.address)}
        </button>
      )}

      {open && (
        <div
          className={
            "absolute top-full mt-2 w-64 z-50 hardware-border bg-surface border-on-surface " +
            (align === "right" ? "right-0" : "left-0")
          }
        >
          <div className="p-4 border-b border-outline-variant">
            <p className="font-mono-label text-[10px] text-on-surface-variant mb-1">CONNECTED_WALLET</p>
            <p className="font-mono-data text-xs break-all">{wallet.address}</p>
            <button
              onClick={handleCopy}
              className="mt-2 flex items-center gap-1 font-mono-label text-[11px] text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-[14px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "COPIED" : "COPY ADDRESS"}
            </button>
          </div>
          {/* Confirmed via GenLayer's own docs (network-configuration page):
              Studionet has no separate faucet page/subpath -- it's a
              built-in 💧 button inside Studio's own account selector, so
              this links to Studio itself rather than guessing a URL (and
              deliberately NOT the testnet-faucet.genlayer.foundation site,
              which funds a different network -- Bradbury/Asimov -- not the
              studionet this app actually runs on). */}
          <a
            href="https://studio.genlayer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant font-mono-label text-mono-label text-secondary hover:bg-secondary hover:text-on-secondary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">water_drop</span>
            NEED TEST GEN? OPEN STUDIO FAUCET
          </a>
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center gap-2 px-4 py-3 font-mono-label text-mono-label text-error hover:bg-error hover:text-on-error transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            DISCONNECT
          </button>
        </div>
      )}
    </div>
  );
}
