"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store";
import { TARGET_CHAIN, TARGET_NETWORK } from "@/lib/genlayer-wallet";

export function NetworkBanner() {
  const { wallet, switchNetwork } = useAppState();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!wallet.wrongNetwork) return null;

  async function handleSwitch() {
    setSwitching(true);
    setError(null);
    try {
      await switchNetwork();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="bg-primary text-on-primary px-margin-mobile md:px-margin-desktop py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-on-primary relative z-40">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-[22px] font-bold">warning</span>
        <div>
          <p className="font-mono-label text-mono-label font-bold">
            WRONG_NETWORK_DETECTED
          </p>
          <p className="font-mono-data text-[11px] opacity-90">
            REQUIRED_CHAIN: {TARGET_NETWORK.toUpperCase()} (ID: {TARGET_CHAIN.id})
          </p>
          {error && <p className="font-mono-data text-[11px] opacity-90">[ERROR] {error}</p>}
        </div>
      </div>
      <button
        onClick={handleSwitch}
        disabled={switching}
        className="bg-on-primary text-primary font-mono-label text-mono-label font-bold px-4 py-2 hover:bg-primary-fixed transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
      >
        {switching ? "SWITCHING..." : "SWITCH NETWORK"}
        <span className="material-symbols-outlined text-[18px]">sync_alt</span>
      </button>
    </div>
  );
}
