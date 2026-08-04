"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store";
import { hasInjectedWallet } from "@/lib/genlayer-wallet";
import { Modal } from "./Modal";
import { ConnectedWalletMenu } from "./WalletMenu";

// Only MetaMask (or another injected EIP-1193 wallet under the same option)
// is actually wired to a real connection -- WalletConnect and a bespoke
// "native" client were never built, so they're shown as unavailable rather
// than silently doing nothing or faking a connection.
const WALLET_OPTIONS = [
  { icon: "electric_bolt", name: "METAMASK", detail: "BROWSER EXTENSION", available: true },
  { icon: "qr_code_2", name: "WALLETCONNECT", detail: "NOT YET AVAILABLE", available: false },
  { icon: "terminal", name: "GEN_BROWSER", detail: "NOT YET AVAILABLE", available: false },
];

export function WalletChip() {
  const { wallet, connectWallet } = useAppState();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setError(null);
    try {
      await connectWallet();
      setDialogOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (wallet.status === "connected") {
    return <ConnectedWalletMenu align="right" />;
  }

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        disabled={wallet.status === "connecting"}
        className="bg-primary text-on-primary px-4 py-2 font-mono-label text-mono-label flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
      >
        {wallet.status === "connecting" ? (
          <>
            <span className="material-symbols-outlined text-[18px] animate-spin">
              refresh
            </span>
            CONNECTING...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[18px]">
              account_balance_wallet
            </span>
            CONNECT WALLET
          </>
        )}
      </button>
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        tag="[01]"
        title="WALLET_SELECTION"
      >
        <div className="space-y-4">
          {!hasInjectedWallet() && (
            <p className="font-mono-data text-mono-data text-error">
              [ERROR] No wallet extension detected. Install MetaMask to continue.
            </p>
          )}
          {error && <p className="font-mono-data text-mono-data text-error">[ERROR] {error}</p>}
          {WALLET_OPTIONS.map((opt) => (
            <button
              key={opt.name}
              onClick={opt.available ? handleConnect : undefined}
              disabled={!opt.available || !hasInjectedWallet()}
              className="w-full group flex items-center justify-between p-4 border border-outline hover:border-primary bg-surface-container-low transition-all disabled:opacity-40 disabled:hover:border-outline"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border border-outline-variant bg-surface flex items-center justify-center group-hover:bg-primary-fixed transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">
                    {opt.icon}
                  </span>
                </div>
                <div className="text-left">
                  <p className="font-mono-label text-mono-label font-bold">{opt.name}</p>
                  <p className="font-mono-data text-[11px] text-on-surface-variant">
                    {opt.detail}
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline-variant group-hover:text-primary">
                chevron_right
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
