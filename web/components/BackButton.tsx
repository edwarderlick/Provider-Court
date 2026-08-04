"use client";

import { useRouter } from "next/navigation";

// Rendered once, centrally, by AppShell for every route that isn't one of
// the top-level nav destinations -- so every "deep" page (order/listing/
// provider detail, appeal, verdict, etc) gets consistent back-navigation
// without each page wiring its own button. Uses real browser history
// (router.back()) rather than a hardcoded parent route per page, since this
// app's nesting isn't uniform (an order can be reached from Browse Listings,
// a dashboard, or Activity) and history already knows which one actually
// happened.
export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1 font-mono-label text-mono-label text-on-surface-variant hover:text-primary transition-colors"
    >
      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
      BACK
    </button>
  );
}
