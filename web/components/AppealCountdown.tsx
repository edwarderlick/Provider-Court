"use client";

import { DEFAULT_APPEAL_WINDOW_SECONDS } from "@/lib/constants";

// Replaces the old raw "APPEAL_WINDOW_CLOSES: <ISO timestamp>" text (which
// required the viewer to do their own timezone math) with a live countdown
// and a depleting bar, reusing the same hardware-border/colored-fill bar
// language already used for Release Progress on this order's own verdict
// page, rather than inventing a new visual style.
//
// `now` is passed in (ticked once/second by the caller via useNowTick)
// rather than run as its own independent timer, so a page showing both this
// countdown AND its own deadline-derived state (e.g. whether the Appeal
// button is disabled) stays perfectly in sync off one shared clock instead
// of two timers drifting relative to each other.
//
// The bar's "full" reference is DEFAULT_APPEAL_WINDOW_SECONDS (600s) --
// what every order has actually used since the appeal-window-duration fix,
// confirmed real. The contract's get_job() only exposes the closing
// appeal_deadline itself, not each job's own stored appeal_window_seconds,
// so there's no on-chain per-order total to read without a contract change
// (out of scope here -- this is a display-only fix). The remaining-time
// countdown text is always exact regardless (computed purely from
// deadline - now); only the bar's fullness reference would be slightly off
// for the rare listing created with a non-default explicit window.
export function AppealCountdown({ deadline, now }: { deadline: string; now: number }) {
  const deadlineMs = new Date(deadline).getTime();
  const remainingMs = deadlineMs - now;
  const closed = remainingMs <= 0;

  const totalMs = DEFAULT_APPEAL_WINDOW_SECONDS * 1000;
  const pct = closed ? 0 : Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const label = closed
    ? "APPEAL WINDOW CLOSED"
    : hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} remaining`
      : `${minutes}:${String(seconds).padStart(2, "0")} remaining`;

  return (
    <div className="flex flex-col gap-1.5 min-w-[220px]">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono-data text-mono-data uppercase text-on-surface-variant">
          Appeal Window
        </span>
        <span
          className={
            "font-mono-data text-mono-data font-bold whitespace-nowrap " +
            (closed ? "text-error" : "text-primary")
          }
        >
          {label}
        </span>
      </div>
      <div className="w-full h-2 hardware-border p-0.5 bg-surface-container-highest relative overflow-hidden">
        <div
          className={"h-full transition-all duration-1000 ease-linear " + (closed ? "bg-error" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
