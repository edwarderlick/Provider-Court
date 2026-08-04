// GenLayer Studio's shared RPC node enforces a fixed pool of execution
// slots and rejects outright ("Server busy: all N execution slots occupied,
// retry later") when saturated, rather than queuing the request. This is
// confirmed to hit both plain reads (gen_call) and the transaction-status
// polling inside genlayer-js's waitForTransactionReceipt (which calls
// client.getTransaction every `interval` ms while waiting) -- neither is
// retried internally by the SDK. Retrying here is always safe: it never
// re-signs or re-broadcasts anything, it just re-asks a node for
// already-existing state.
const BUSY_PATTERN = /server busy|execution slots occupied|rate limit exceeded/i;

// A real "Retry automatic fulfillment" click failed with a completely
// different, unretried error: "GenLayer RPC error (gen_call): fetch
// failed" -- Node's raw TypeError for a connection-level failure (reset,
// timeout, DNS hiccup, transient TLS failure), not a Studio-specific
// "busy" JSON-RPC response. The pattern above never matched it, so a
// read that hit a one-off network blip was rethrown on the very first
// attempt instead of being retried -- the single worst place for that to
// happen, since this IS the recovery path. Retrying these is exactly as
// safe as retrying a busy-node response: withBusyRetry is only ever used
// to wrap idempotent reads and receipt-status polling in this codebase
// (see genlayer-server.ts), never a write submission itself, so there is
// no double-submission risk from retrying a network-level failure either.
// A real appeal submission on order #21 surfaced this same failure mode in
// a spot that WAS already wrapped in withBusyRetry (waitFinalizedInBrowser
// in genlayer-wallet.ts, used by every wallet-signed write) yet still threw
// straight through on the first attempt -- confirmed directly by reading
// order #21's real on-chain state right after: it was genuinely Disputed,
// i.e. the transaction had already succeeded (MetaMask's own "Transaction 3
// confirmed!" was correct), and only the receipt-polling read that runs
// after signing failed to fetch. The message was "An unknown RPC error
// occurred. Details: Failed to fetch" -- the browser's own TypeError text
// for a network-layer fetch failure (Chrome/Edge phrase it "Failed to
// fetch", capitalized and reversed word order), distinct from the
// "fetch failed" wording Node/undici uses server-side (already matched
// above from genlayer-server.ts's own operator-client reads). Neither this
// pattern nor any other above matched "Failed to fetch" verbatim, so
// isBusyError returned false and withBusyRetry rethrew immediately instead
// of retrying -- not a missing wrapper, a gap in what the existing wrapper
// recognizes as transient.
const TRANSIENT_NETWORK_PATTERN =
  /fetch failed|failed to fetch|network(?:\s|-)?error|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|UND_ERR/i;

// A third real, distinct failure shape: "GenLayer RPC error (gen_call):
// Unexpected token '<', "<!DOCTYPE "... is not valid JSON" -- confirmed
// directly (not assumed) by hitting studio.genlayer.com's bare domain
// (not /api): it serves GenLayer's actual marketing site, a real HTML
// document, and studio.genlayer.com/api itself sits behind Cloudflare
// (confirmed via response headers: `Server: cloudflare`, a `CF-RAY` id).
// Neither pattern above matches this: it's not Studio's own "server busy"
// JSON-RPC error, and the underlying HTTP request itself succeeded (this is
// a JSON.parse SyntaxError on a 2xx/edge-served body, not a network-level
// fetch failure) -- almost certainly a Cloudflare-edge-level intervention
// (rate-limiting/bot-mitigation/a gateway error page) in front of Studio's
// own app logic, serving Cloudflare's standard HTML page instead of
// forwarding to the JSON-RPC handler, distinct from and in addition to the
// two failure modes above. Confirmed live in this project's own server log
// hitting multiple different read routes (gen_call via get_job/get_listing/
// get_provider) during a burst of heavy request volume, correlating with
// recent automated verification runs -- not something any legitimate
// contract-level answer would ever look like, so treating it as transient
// and retrying is exactly as safe as the two patterns above (this is only
// ever used to wrap idempotent reads and receipt polling, never a write
// submission).
const HTML_RESPONSE_PATTERN = /Unexpected token '<'|is not valid JSON|<!doctype/i;

export function isBusyError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const causeMessage = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
  const causeCode = err instanceof Error && err.cause && typeof err.cause === "object" ? (err.cause as { code?: string }).code ?? "" : "";
  const combined = `${message} ${causeMessage} ${causeCode}`;
  return (
    BUSY_PATTERN.test(combined) ||
    TRANSIENT_NETWORK_PATTERN.test(combined) ||
    HTML_RESPONSE_PATTERN.test(combined)
  );
}

export async function withBusyRetry<T>(
  fn: () => Promise<T>,
  attempts = 6,
  baseDelayMs = 1500
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isBusyError(err) || i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
    }
  }
  throw lastErr;
}

// Runs `items` through `fn` with at most `limit` in flight at once, instead
// of Promise.all's unbounded concurrency -- firing e.g. 13 concurrent reads
// at a node that only has 8 execution slots is itself a likely cause of
// "Server busy" responses, self-inflicted by our own job-list reads.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
