"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { WalletChip } from "./WalletChip";
import { ConnectedWalletMenu } from "./WalletMenu";
import { NetworkBanner } from "./NetworkBanner";
import { Footer } from "./Footer";
import { BackButton } from "./BackButton";
import { useAppState } from "@/lib/store";

// Every route reachable directly from TOP_NAV/SIDE_NAV/MOBILE_NAV below --
// i.e. every page that IS a landing point, not a "deep" page reached by
// drilling into something (an order, a listing, a provider, an appeal/verdict
// flow). Anything not in this set gets a back button rendered once, centrally,
// rather than each deep page wiring its own.
const TOP_LEVEL_ROUTES = new Set([
  "/",
  "/listings/browse",
  "/listings/new",
  "/dashboard/buyer",
  "/dashboard/provider",
  "/activity",
  "/providers/register",
]);

const TOP_NAV = [
  { key: "browse", label: "[01] BROWSE LISTINGS", href: "/listings/browse" },
  { key: "providers", label: "[02] PROVIDERS", href: "/providers/register" },
  { key: "activity", label: "[03] ACTIVITY", href: "/activity" },
];

// [ANALYTICS] and [ESCROW] have no dedicated route in the requested route
// list (Task 2), so they point at the closest existing page rather than a
// new invented screen — Activity Ledger doubles as the network/analytics
// view, and Browse Listings is the closest thing to an "escrow" listing.
// Post Job / Browse Jobs (buyer posts a custom job, provider accepts) have
// been replaced by List Service / Buy Now (provider lists once, buyer pays
// outright) -- see contract/README.md for the full pivot.
const SIDE_NAV = [
  { key: "dashboard", label: "[DASHBOARD]", icon: "dashboard", href: "/dashboard/buyer" },
  { key: "list", label: "[LIST SERVICE]", icon: "add_box", href: "/listings/new" },
  { key: "deliveries", label: "[DELIVERIES]", icon: "package_2", href: "/dashboard/provider" },
  { key: "analytics", label: "[ANALYTICS]", icon: "query_stats", href: "/activity" },
  { key: "escrow", label: "[ESCROW]", icon: "account_balance_wallet", href: "/listings/browse" },
];

const MOBILE_NAV = [
  { label: "DASHBOARD", icon: "dashboard", href: "/dashboard/buyer" },
  { label: "BROWSE", icon: "search", href: "/listings/browse" },
  { label: "LIST", icon: "add_box", href: "/listings/new" },
  { label: "DELIVERIES", icon: "package_2", href: "/dashboard/provider" },
  { label: "ACTIVITY", icon: "receipt_long", href: "/activity" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { wallet, disconnectWallet } = useAppState();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 bg-surface border-b border-outline">
        <div className="flex items-center gap-technical-gap md:gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-headline-md text-[20px] md:text-headline-md tracking-tighter text-primary font-black"
          >
            <img src="/logo.png" alt="" className="w-6 h-6 md:w-7 md:h-7" />
            PROVIDER COURT
          </Link>
          <nav className="hidden md:flex gap-6">
            {TOP_NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={
                    "font-mono-label text-mono-label px-2 py-1 transition-colors " +
                    (active
                      ? "text-primary border-b-2 border-primary font-bold"
                      : "text-on-surface-variant hover:bg-surface-container-high")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button className="hidden md:inline-flex font-mono-label text-mono-label px-4 py-2 border border-outline hover:bg-surface-container-high transition-colors">
            GOVERNANCE
          </button>
          <WalletChip />
        </div>
      </header>

      <aside className="hidden lg:flex fixed left-0 top-16 h-[calc(100vh-64px)] w-64 flex-col z-40 bg-surface-container-low border-r border-outline">
        <div className="p-6 border-b border-outline">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-container-highest border border-outline flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">account_circle</span>
            </div>
            <div className="min-w-0">
              {wallet.status === "connected" ? (
                <ConnectedWalletMenu variant="text" align="left" />
              ) : (
                <p className="font-mono-label text-mono-label font-bold text-primary">NOT_CONNECTED</p>
              )}
              <p className="text-[10px] font-mono-data text-on-surface-variant flex items-center gap-1">
                <span
                  className={
                    "w-1.5 h-1.5 rounded-full " +
                    (wallet.status === "connected" ? "bg-secondary" : "bg-outline")
                  }
                />
                STATUS: {wallet.status === "connected" ? "CONNECTED" : "DISCONNECTED"}
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {SIDE_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={
                  "flex items-center gap-3 px-6 py-3 font-mono-label text-mono-label transition-transform duration-150 " +
                  (active
                    ? "bg-primary text-on-primary border-l-4 border-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-highest hover:translate-x-1")
                }
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-outline space-y-2">
          <button
            className="w-full border border-primary text-primary font-mono-label text-mono-label py-2 hover:bg-primary-fixed transition-colors"
            title="No active job context — open a job's Appeal flow to file a real dispute"
          >
            NEW DISPUTE
          </button>
          <div className="pt-2 flex flex-col gap-1">
            <a className="flex items-center gap-2 font-mono-data text-mono-data text-on-surface-variant hover:text-primary transition-colors" href="#">
              <span className="material-symbols-outlined text-[16px]">settings</span> SETTINGS
            </a>
            <button
              onClick={disconnectWallet}
              className="flex items-center gap-2 font-mono-data text-mono-data text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span> LOGOUT
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 pt-16 pb-20 lg:pb-0 lg:ml-64 flex flex-col">
        <NetworkBanner />
        {!TOP_LEVEL_ROUTES.has(pathname) && (
          <div className="px-margin-mobile md:px-margin-desktop pt-6">
            <BackButton />
          </div>
        )}
        {children}
      </main>

      <div className="lg:ml-64">
        <Footer />
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 w-full h-16 bg-surface border-t border-outline flex items-center justify-around z-50">
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex flex-col items-center gap-1 w-full " +
                (active ? "text-primary" : "text-on-surface-variant")
              }
            >
              <span
                className="material-symbols-outlined"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-mono-data text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
