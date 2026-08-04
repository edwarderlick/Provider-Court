"use client";

import { createClient, simplifyTransactionReceipt } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { withBusyRetry } from "./rpc-retry";

// Real MetaMask (or other EIP-1193 injected wallet) integration, confirmed
// against genlayer-js's actual source (not assumed from general EVM/wagmi
// knowledge -- this SDK's wallet story is GenLayer-specific):
//   - createClient({ chain, account: address, provider: window.ethereum })
//     is the documented pattern (genlayer-js repo docs, and confirmed in
//     source: passing `account` as a plain address STRING, not an Account
//     object from createAccount(), makes the client route signing methods
//     (eth_sendTransaction, personal_sign, etc.) through `provider` instead
//     of local key signing).
//   - client.connect(network) additionally adds/switches the wallet's chain
//     via wallet_addEthereumChain/wallet_switchEthereumChain AND installs a
//     GenLayer-specific MetaMask Snap ("npm:genlayer-wallet-plugin") via
//     wallet_requestSnaps -- confirmed by reading genlayer-js's own
//     src/wallet/connect.ts (bundled in dist/index.js). Snap install failure
//     is treated as non-fatal here (older MetaMask / non-Flask builds may
//     reject wallet_requestSnaps) since basic tx signing does not strictly
//     require it.
// Docs status: GenLayer's own docs site states wallet integration isn't
// fully written up yet ("additional features are planned... including
// wallet integration") -- this is shipped SDK code, just not yet in the
// polished docs, so behavior was verified from source rather than a guide.

export type GenLayerNetwork = "localnet" | "studionet" | "testnetAsimov" | "testnetBradbury";

// Which network the wallet connect flow targets locally. This is NOT the
// public-deployment network decision -- that remains separate and unmade.
export const TARGET_NETWORK = (process.env.NEXT_PUBLIC_GENLAYER_NETWORK ||
  "studionet") as GenLayerNetwork;

const CHAIN_BY_NETWORK: Record<GenLayerNetwork, any> = {
  localnet: chains.localnet,
  studionet: chains.studionet,
  testnetAsimov: chains.testnetAsimov,
  testnetBradbury: chains.testnetBradbury,
};

export const TARGET_CHAIN = CHAIN_BY_NETWORK[TARGET_NETWORK];

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).ethereum);
}

function getProvider(): any {
  if (!hasInjectedWallet()) {
    throw new Error("No wallet extension detected. Install MetaMask to continue.");
  }
  return (window as any).ethereum;
}

export async function requestAccounts(): Promise<string> {
  const provider = getProvider();
  const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts?.[0]) throw new Error("No account returned by wallet.");
  return accounts[0];
}

// Silent check (no popup) for whether this site is already authorized --
// standard pattern for reconnecting on page reload without re-prompting.
export async function getAuthorizedAccounts(): Promise<string[]> {
  if (!hasInjectedWallet()) return [];
  const provider = getProvider();
  try {
    return await provider.request({ method: "eth_accounts" });
  } catch {
    return [];
  }
}

export async function getCurrentChainIdHex(): Promise<string> {
  const provider = getProvider();
  return provider.request({ method: "eth_chainId" });
}

export function isOnTargetChain(chainIdHex: string): boolean {
  return parseInt(chainIdHex, 16) === TARGET_CHAIN.id;
}

export function getWalletWriteClient(address: string) {
  const provider = getProvider();
  return createClient({ chain: TARGET_CHAIN, account: address as `0x${string}`, provider });
}

// Switches/adds the wallet's chain and (best-effort) installs the GenLayer
// snap. Safe to call repeatedly -- connect() is idempotent on an
// already-correct chain.
export async function switchToTargetNetwork(address: string): Promise<void> {
  const client = getWalletWriteClient(address);
  try {
    await client.connect(TARGET_NETWORK);
  } catch (err) {
    console.warn("client.connect() did not fully complete (snap install may be unavailable):", err);
    // Still try a raw chain switch so basic signing works even if the
    // GenLayer snap couldn't be installed.
    const provider = getProvider();
    const chainIdHex = `0x${TARGET_CHAIN.id.toString(16)}`;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
    } catch {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: TARGET_CHAIN.name,
            rpcUrls: TARGET_CHAIN.rpcUrls.default.http,
            nativeCurrency: TARGET_CHAIN.nativeCurrency,
            blockExplorerUrls: [TARGET_CHAIN.blockExplorers?.default?.url].filter(Boolean),
          },
        ],
      });
    }
  }
}

export function onAccountsChanged(cb: (accounts: string[]) => void): () => void {
  if (!hasInjectedWallet()) return () => {};
  const provider = getProvider();
  provider.on?.("accountsChanged", cb);
  return () => provider.removeListener?.("accountsChanged", cb);
}

export function onChainChanged(cb: (chainIdHex: string) => void): () => void {
  if (!hasInjectedWallet()) return () => {};
  const provider = getProvider();
  provider.on?.("chainChanged", cb);
  return () => provider.removeListener?.("chainChanged", cb);
}

// Same finalized-but-reverted check used server-side (lib/genlayer-server.ts)
// -- a transaction reaching FINALIZED status can still be a unanimously
// agreed-upon revert, which waitForTransactionReceipt alone does not surface.
export async function waitFinalizedInBrowser(client: ReturnType<typeof createClient>, hash: any) {
  // Studio's shared RPC node can reject a poll iteration outright with
  // "Server busy: all N execution slots occupied, retry later" instead of
  // queuing it -- that's a node capacity error, not a signal about this
  // transaction. Retrying here is safe: the transaction was already
  // broadcast before this function runs, so re-polling for the same hash
  // never resends anything or risks a duplicate submission.
  const receipt = await withBusyRetry(() =>
    client.waitForTransactionReceipt({
      hash,
      status: "FINALIZED" as any,
      retries: 60,
      interval: 3000,
    })
  );
  const simplified = simplifyTransactionReceipt(receipt) as any;
  const leaderReceipt = simplified?.consensus_data?.leader_receipt?.[0];
  if (leaderReceipt?.execution_result === "ERROR") {
    const message = leaderReceipt?.result?.payload ?? "transaction reverted";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return receipt;
}
