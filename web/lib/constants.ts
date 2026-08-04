// Shared default for a listing/job's appeal window -- how long after
// adjudication a dispute can still be raised before claim_settlement can
// pay out. Used as the fallback whenever a caller doesn't specify their own
// appealWindowSeconds -- the contract itself still stores whatever value is
// actually passed per listing/job, so this is a UI default, not a hard
// contract limit.
//
// 180s was tried first and confirmed too tight: the contract stamps
// appeal_deadline from the adjudicate transaction's own message datetime
// (provider_court_escrow.py's _now(), read from gl.message_raw["datetime"]
// -- the timestamp assigned when that transaction was submitted, shared
// deterministically across every validator), not from whenever the client
// eventually observes the finalized verdict. That's the correct anchor in
// principle (real, per-order verdict-ready time, not purchase time), but
// real GenVM consensus for adjudicate itself -- leader + validators each
// independently re-running the LLM clause checks and agreeing -- takes real
// wall-clock time that elapses AFTER that timestamp is stamped and BEFORE
// the buyer's browser can ever show the result. Measured directly against
// two fresh real orders end-to-end: adjudicate consensus alone consumed
// 69-77s of the window before the client's own purchase request even
// returned, leaving only 110-130s of the nominal 180s by the time a buyer
// could first see the verdict -- and this session's own timing
// re-measurement already found the full pipeline (of which adjudicate is
// the largest single stage) regularly running slower under real Studio load,
// meaning that margin can shrink much further or hit zero, not just in a
// rare edge case. Raised to 600s (10 minutes) so a buyer still gets a
// genuinely comfortable multi-minute decision window even after subtracting
// a much slower-than-typical adjudicate round, rather than carving the
// buyer's entire reading/deciding time out of the same budget consensus
// latency is silently eating into.
export const DEFAULT_APPEAL_WINDOW_SECONDS = 600;
