"use client";

// Persistent (survives navigation/remount) guard against re-submitting a
// write for the same job+action while an earlier attempt is still
// finalizing. Component state like `useState` alone is not enough: it
// resets on any remount (browser back/forward, revisiting the page,
// Fast Refresh), so a user who navigates away mid-wait and comes back sees
// a "fresh" unlocked button and can genuinely fire a second real
// transaction while the first is still pending -- confirmed as the actual
// cause of repeat accept_job submissions, not a missing disabled attribute.
const PREFIX = "pc-inflight:";
// Real GenVM consensus rounds have been observed taking up to ~90s for
// non-adjudicate writes in this app; 10 minutes is a generous ceiling so an
// abandoned tab/closed browser doesn't permanently block the action.
const STALE_MS = 10 * 60 * 1000;

function key(jobId: string | number, action: string): string {
  return `${PREFIX}${action}:${jobId}`;
}

export function isLocked(jobId: string | number, action: string): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(key(jobId, action));
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts) || Date.now() - ts > STALE_MS) {
    window.localStorage.removeItem(key(jobId, action));
    return false;
  }
  return true;
}

export function acquireLock(jobId: string | number, action: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(jobId, action), String(Date.now()));
}

export function releaseLock(jobId: string | number, action: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(jobId, action));
}

// "[EXPECTED]"-prefixed messages are the contract's own deterministic
// business-logic rejections (see contract/contracts/provider_court_escrow.py
// -- every validator agrees on these independent of network conditions),
// same convention already used server-side in lib/genlayer-server.ts's
// statusForError(). An error like "[EXPECTED] provider not registered for
// modality 'IMAGE'" is a definitive, confirmed answer that this specific
// attempt did not and could not have changed the job's state -- it is safe
// to release the lock immediately without a fresh-read round-trip. Treating
// this the same as an ambiguous network/timeout error (which genuinely
// cannot confirm what happened) was what left the lock stuck.
export function isDefiniteRejection(message: string): boolean {
  return message.startsWith("[EXPECTED]");
}
