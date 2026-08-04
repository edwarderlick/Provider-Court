"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { WalletState } from "./types";
import {
  getAuthorizedAccounts,
  getCurrentChainIdHex,
  hasInjectedWallet,
  isOnTargetChain,
  onAccountsChanged,
  onChainChanged,
  requestAccounts,
  switchToTargetNetwork,
} from "./genlayer-wallet";

// Real wallet connect: MetaMask (or another injected EIP-1193 wallet) is
// requested directly, the wallet's own chain id is checked against the
// GenLayer network this app targets, and the resulting address is what
// every buyer/provider action in lib/chain-client.ts signs with. There is
// no more mock/simulated connect path -- see genlayer-wallet.ts for the
// real (source-verified) GenLayer wallet integration details.
const DEFAULT_WALLET: WalletState = { status: "disconnected", address: null, wrongNetwork: false };

interface AppStateValue {
  wallet: WalletState;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>(DEFAULT_WALLET);

  const refreshChainStatus = useCallback(async () => {
    try {
      const chainIdHex = await getCurrentChainIdHex();
      setWallet((w) => (w.status === "connected" ? { ...w, wrongNetwork: !isOnTargetChain(chainIdHex) } : w));
    } catch {
      // wallet may have been removed/locked; leave state as-is
    }
  }, []);

  useEffect(() => {
    if (!hasInjectedWallet()) return;
    // Silent reconnect on mount -- eth_accounts (unlike eth_requestAccounts)
    // returns already-authorized accounts with no popup.
    getAuthorizedAccounts().then(async (accounts) => {
      if (accounts.length === 0) return;
      const chainIdHex = await getCurrentChainIdHex();
      setWallet({ status: "connected", address: accounts[0], wrongNetwork: !isOnTargetChain(chainIdHex) });
    });
  }, []);

  useEffect(() => {
    if (!hasInjectedWallet()) return;
    const offAccounts = onAccountsChanged((accounts) => {
      if (accounts.length === 0) {
        setWallet({ status: "disconnected", address: null, wrongNetwork: false });
      } else {
        setWallet((w) => (w.status === "connected" ? { ...w, address: accounts[0] } : w));
      }
    });
    const offChain = onChainChanged(() => {
      refreshChainStatus();
    });
    return () => {
      offAccounts();
      offChain();
    };
  }, [refreshChainStatus]);

  const connectWallet = useCallback(async () => {
    setWallet({ status: "connecting", address: null, wrongNetwork: false });
    try {
      const address = await requestAccounts();
      const chainIdHex = await getCurrentChainIdHex();
      const wrongNetwork = !isOnTargetChain(chainIdHex);
      setWallet({ status: "connected", address, wrongNetwork });
    } catch (err) {
      setWallet({ status: "disconnected", address: null, wrongNetwork: false });
      throw err;
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    // EIP-1193 has no real "revoke" call most wallets support universally --
    // this clears the dApp's own local session, same as every other dApp's
    // "disconnect" button.
    setWallet({ status: "disconnected", address: null, wrongNetwork: false });
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!wallet.address) return;
    await switchToTargetNetwork(wallet.address);
    await refreshChainStatus();
  }, [wallet.address, refreshChainStatus]);

  const value = useMemo<AppStateValue>(
    () => ({ wallet, connectWallet, disconnectWallet, switchNetwork }),
    [wallet, connectWallet, disconnectWallet, switchNetwork]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
