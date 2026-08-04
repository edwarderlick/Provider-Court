"use client";

// Componentizes the "[ERROR] {message}" paragraph convention that already
// appears independently in ~15 places across this app (WalletChip,
// NetworkBanner, orders/[id]/verdict, etc) so the handful of write actions
// that were instead using a raw browser alert() -- which blocks the thread
// and looks nothing like the rest of the app's error surfaces -- can be
// switched to the same convention already proven elsewhere, not a new one.
export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="font-mono-data text-mono-data text-error">[ERROR] {message}</p>;
}
