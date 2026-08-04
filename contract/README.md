# Sample GenLayer project
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/license/mit/)
[![Discord](https://dcbadge.vercel.app/api/server/8Jm4v89VAu?compact=true&style=flat)](https://discord.gg/8Jm4v89VAu)
[![Telegram](https://img.shields.io/badge/Telegram--T.svg?style=social&logo=telegram)](https://t.me/genlayer)
[![Twitter](https://img.shields.io/twitter/url/https/twitter.com/yeagerai.svg?style=social&label=Follow%20%40GenLayer)](https://x.com/GenLayer)
[![GitHub star chart](https://img.shields.io/github/stars/yeagerai/genlayer-project-boilerplate?style=social)](https://star-history.com/#yeagerai/genlayer-js)

## 👀 About
This project includes the boilerplate code for a GenLayer use case implementation, specifically a football bets game.

## 🚀 Provider Court deployments

The actual contract for this project is `contracts/provider_court_escrow.py` (the football
bets example above is unused boilerplate left over from the project scaffold).

### GenLayer Studio (live, current — IMAGE/AUDIO clause fix + delivered-content display)
- **Address:** `0x2B29BaA63b1Bff0de560dc61c71feEAb7EF67586`
- **Network:** `studionet` (chain id 61999, `https://studio.genlayer.com/api`, gasless)
- Fixes two real bugs found in production use, both scoped to clause derivation and content
  display only -- adjudication's core logic, appeal flow, and wallet-connect signing are
  untouched. See "IMAGE/AUDIO clause fix and delivered-content display" below for full detail.
- **Bug 1 (severe):** `_fetch_artifact` decodes every delivered artifact as UTF-8 text
  regardless of modality. For IMAGE/AUDIO that means any semantic content clause is checked
  against raw binary bytes decoded as garbage -- unwinnable regardless of delivery quality (a
  genuinely correct anime image failed "must mention <subject>" purely because JPEG bytes
  aren't readable prose). Fixed by having `deriveClauses()` return no content clauses at all for
  non-TEXT modalities, and relaxing `_validate_clauses` (now takes `min_len`) so
  `create_listing` accepts an empty `content_clauses` list -- the contract's own baseline
  modality clause is the only check an IMAGE/AUDIO listing gets.
- **Bug 2:** the "view delivered artifact" link built its URL as
  `https://ipfs.io/ipfs/${cid}` unconditionally -- a third-party public gateway that has to
  discover pinned content via DHT/bitswap rather than a domain guaranteed to actually have it,
  and for one legacy `data:`-URI "cid" order produced a URL that could never resolve at all.
  Fixed by reading from `gateway.pinata.cloud` (where the bytes were actually uploaded) and
  passing `data:` URIs through unchanged, plus a new `ArtifactViewer` component that renders the
  artifact inline (image/audio/text) directly on the order page, visible as soon as delivery
  completes -- not gated behind adjudication finishing.
- This contract-level change is only Bug 1's `min_len` relaxation; Bug 2 is entirely
  application-side and was also confirmed working against the **previous** (still-live-until-
  now) contract address, including on a real pre-existing order (a One Piece Roronoa Zoro image,
  order #7 on the prior address) -- its old clause verdicts remain as they were (not
  re-adjudicatable with corrected clauses, the same constraint hit by the earlier clause-quality
  fix), but the image itself now renders correctly, since the display fix doesn't depend on
  which contract version delivered it.
- Verified live on Studio end-to-end on this new contract: an IMAGE listing created with
  `content_clauses=[]` stored exactly 1 clause (the baseline); a real Cloudflare-generated image
  was purchased, delivered, and adjudicated for real, with exactly 1 clause verdict (the
  baseline), which genuinely PASSED on real binary image data, settling `Released`/100%; a
  second IMAGE order was checked specifically in the `Delivered` (pre-adjudication) state and
  confirmed to already render inline on the order page at that point; a TEXT listing on the same
  fresh contract was separately confirmed to still get baseline + 1 real derived content clause,
  unaffected by this fix.

### GenLayer Studio (superseded — auto-derived clauses, no manual authoring)
- **Address:** `0x883AC50fD33B0CABCf59a5a0795EcaEe0eab77E9`
- **Network:** `studionet` (chain id 61999, `https://studio.genlayer.com/api`, gasless)
- A fresh deploy (not an upgrade -- GenVM contracts aren't upgradable in place). Manual clause
  authoring is gone from the UI entirely -- `create_listing`'s clause parameter is now
  `content_clauses` (the provider's own derived content checks only; the contract itself always
  prepends a fixed baseline modality-integrity clause via `_baseline_modality_clause`, never
  supplied or overridable by the caller), and `purchase` gained `buyer_clauses` (up to 2,
  derived off-chain from the buyer's own input, validated with the same `_validate_clause_shape`
  as everything else). See "Auto-derived clauses" below for the full design and the honesty
  constraint this works within (the untouched adjudication mechanism decodes every delivered
  artifact as UTF-8 text, regardless of modality). Verified live on Studio end-to-end through
  the real UI: a listing created from just a plain description ("write a haiku about the
  ocean") with no clause form anywhere, correctly deriving a haiku-format clause and an "ocean"
  clause, previewed read-only in the Review & List modal before commit; a real purchase with
  buyer input ("make it about a friendly whale instead") correctly deriving its own extra
  clause AND still feeding the same text into the generation prompt; real Gemini generation +
  Pinata pinning + delivery + adjudication all completing for real, with all 4 clauses (baseline
  + 2 content + 1 buyer) genuinely evaluated with real per-clause evidence -- 3 passed, 1
  (`must_contain: "a friendly whale"`, against a delivered haiku that said "gentle giant" and
  "friendly tail") genuinely failed, settling `PartiallyReleased` at 70%. That mixed, non-unanimous
  result is itself the strongest evidence the baseline and content clauses are being evaluated
  for real, not rubber-stamped. (Order #0 on this contract is a harmless stuck test artifact
  from an earlier verification attempt that used an invalid fake CID -- `submit_delivery`
  accepted it, but `adjudicate` correctly rejects a CID that doesn't match what was delivered.
  Doesn't affect the listing or any other order; left as-is rather than redeployed again just
  to erase it from a not-yet-public contract.)

### GenLayer Studio (superseded — buyer input always optional)
- **Address:** `0xC7C9d0C0f133F5540b3A306e013dE38c51d0EfAd`
- Predates auto-derived clauses -- listings and purchases still took a manually-authored
  `clauses` array typed by the provider through a Clause Builder UI. Superseded for that reason.
  `purchase()` no longer hard-rejects a blank `buyer_input` on a listing flagged `requires_input=true` --
  that flag is now UI guidance only (which hint text a buyer sees), and never gates whether a
  purchase can proceed. Fixes a real product gap that had already caused confusion twice: a
  provider whose description clearly needs customization (e.g. "give me your description") but
  who forgot to set the flag left buyers with no way to supply anything at all; separately, a
  listing that wasn't flagged silently *ignored* buyer input even when a buyer supplied it.
  Both are fixed by the same change: `_combine_prompt` no longer takes or checks
  `requires_input` at all -- it always combines a non-blank `buyer_input` with the listing's
  description, and always falls back to the description alone when blank, for every listing
  regardless of its flag. Verified live on Studio, 3 of 4 combinations via fresh transactions
  this session (the 4th -- flag=NO + blank -- is an unconditional early-return independent of
  the flag, extensively verified working in the prior buyer-input deployment, and confirmed via
  a read-only UI pass since the daily write quota was fully exhausted before that last
  transaction): flag=YES+blank now succeeds with the description unchanged (previously
  rejected); flag=YES+filled combines (unchanged from before); flag=NO+filled now combines
  (previously silently ignored the buyer's text); flag=NO+blank stays description-only
  (unchanged non-negotiable path).

### GenLayer Studio (superseded — additive provider modality registration)
- **Address:** `0x14FeB0F41edd614136932f610375ef263042696B`
- Predates buyer input always being optional -- `requires_input=true` still hard-blocked a
  blank `buyer_input` at `purchase()`. Superseded for that reason; `add_modality` carries over
  unchanged into the current deployment. Kept as historical record; the live app no longer
  reads from or depends on this address.

### GenLayer Studio (superseded — buyer-input on purchase, no add_modality)
- **Address:** `0x6AB7DA8e119102C50ddF5ACEB118051F5A484218`
- Added two fields to `Listing` (`requires_input: bool`, `input_hint: str`) and one parameter
  to `purchase` (`buyer_input: str = ""`), combining it with the listing's description when
  supplied. At this point `requires_input=true` still hard-rejected a blank `buyer_input`, and
  `add_modality` didn't exist yet -- a provider registered for one modality had no on-chain path
  to add another. Superseded for both reasons. Kept as historical record; the live app no
  longer reads from or depends on this address.

### GenLayer Studio (superseded — provider-listed-services pivot, no buyer input)
- **Address:** `0x1096465927ad865de0871A7F1c6457252e304Ac1`
- Predates `Listing.requires_input`/`input_hint` and `purchase`'s `buyer_input` parameter --
  every purchase used the listing's raw description as the entire generation prompt, which
  fails for a listing explicitly templated to need buyer-supplied detail (e.g. a description
  like "give me your description"). Verified working at the time for the listings/purchase
  flow itself (see git history for the full verification notes); superseded because it has no
  way to combine buyer-supplied content with a listing's description. Kept as historical record;
  the live app no longer reads from or depends on this address.

### GenLayer Studio (superseded — pre-pivot buyer-posts-a-job flow)
- **Address:** `0x8432b1AE7346F1aF0B333Faf1b4B99a954AeED40`
- Predates `create_listing`/`purchase`. Verified end-to-end at the time: `register_provider`,
  `create_job`, `fund_job`, `accept_job`, `submit_delivery` (with a real
  provider-service-generated CID pinned to IPFS), `adjudicate` (real GenVM
  Equivalence-Principle LLM consensus), and `claim_settlement` all executed successfully as
  real transactions. Kept here as historical record; the live app no longer reads from or
  depends on this address.

### Bradbury testnet (historical record only — read path broken, not depended upon)
- **Address:** `0x8F4BAaFA25F00DfE4626E38815f4b4c877a9ed36`
- **Deploy tx:** `0x4ecfe149526de7732023f5b56fa669d963570bb1087f482c33c87f26267e67ff` (FINALIZED)
- **`register_provider` tx:** `0xd1a6aa621bcb401b04bd9415096eee5d9e54f566b55c9ed28647f4e405c58900`
  (FINALIZED, 5/5 validators AGREE — full consensus)
- Both transactions are confirmed fully indexed on Bradbury's own explorer. However,
  `rpc-bradbury.genlayer.com`'s read path (`gen_call`, `gen_getContractCode`,
  `gen_getContractSchema`) fails with "contract not found" for this address regardless of
  finality parameter (`status`/`transactionHashVariant` — tested exhaustively, no combination
  works), via both the Python CLI and genlayer-js 1.1.8, despite writes succeeding cleanly.
  This is a confirmed Bradbury-side read-serving bug, reported upstream on GenLayer's Discord.
  A parallel check of the zkSync-OS RPC the official faucet points at
  (`zksync-os-testnet-genlayer.zksync.dev`) confirmed the same chain id (4221) but no
  `gen_*` RPC method support at all (`Method not found`) — it's the underlying execution
  layer's raw endpoint, not a substitute GenLayer consensus node.
- Kept here as historical proof of a correct deployment and successful full-consensus write;
  the live app does not read from or depend on this deployment.

## 🔄 Provider-listed services (pivot from buyer-posts-a-job)

The original flow was: buyer posts a custom job with clauses and funds escrow, open call, a
registered provider manually accepts, then manually delivers. This restructures the front half
of that flow -- delivery, adjudication, appeal, and settlement mechanics are the exact same
proven code, completely untouched:

- **A registered provider lists a service once** (`create_listing`): modality, description
  (the actual generation prompt/spec), a fixed price, and the clauses their own delivery must
  satisfy -- the provider states their own delivery standard up front, not a buyer's spec.
- **A buyer buys** (`purchase`, payable): one wallet confirmation, exact price attached.
  Payment succeeding immediately spawns a normal escrow record already in `Accepted` state --
  there is no separate `accept_job` step for these orders, payment IS the claim.
- **Listings are reusable by design** (the explicit default, not the alternative): each
  purchase spawns its own independent order that goes through delivery/adjudication/settlement
  on its own, while the listing stays live for the next buyer until the provider calls
  `set_listing_active(id, false)`.
- **Generation and adjudication are automatic on every single purchase**, never dispute-only:
  the app itself (`web/lib/genlayer-server.ts`'s `autoFulfillOrder`, triggered via
  `POST /api/chain/orders/[id]/auto-fulfill` right after the buyer's own purchase transaction
  finalizes) calls the same already-verified generation/pinning pipeline, then calls
  `submit_delivery` and `adjudicate` itself -- no provider ever clicks "deliver" for these
  orders.
- **`submit_delivery`'s one intentional contract change:** it now also accepts a signature
  from a fixed `fulfillment_operator` address (set once at deploy time via the constructor),
  in addition to the order's actual `provider`. This is what makes automatic delivery possible
  for a real third-party provider's order -- nobody is at a keyboard to sign at delivery time,
  and the app has no way to sign as an arbitrary provider's own wallet. A stranger still cannot
  call `submit_delivery` (verified directly: rejected with `[EXPECTED] only the assigned
  provider or the fulfillment operator can deliver`); only `job.provider` or this one
  app-controlled address can. Every other write keeps its original authorization checks
  unchanged.
- **`get_order`** wraps the untouched `get_job` view and adds one field, `listing_id` (`-1` for
  legacy jobs created via `create_job` rather than `purchase`) -- everything else about an
  order's shape is identical to a job.
- **Legacy `create_job`/`fund_job`/`accept_job` remain in the contract**, unmodified and still
  fully functional (verified directly), for backward compatibility -- they're just no longer
  the primary entry point the frontend exposes.

## ✍️ Buyer input on purchase

Some listings are self-contained (e.g. "check example.com" needs no further input from the
buyer); others are explicitly templated to need buyer-supplied detail (e.g. "I can generate an
image, give me your description"). Originally `purchase` sent the listing's raw description as
the *entire* generation prompt, which fails outright for the templated case -- there's nothing
for the model to actually generate from. This closes that gap without touching adjudication,
appeal, or the wallet-signing paths:

- **`Listing` gained two fields**, set at `create_listing` time: `requires_input: bool` (default
  `False`) and `input_hint: str` (a short provider-authored hint of what to ask for, e.g.
  "describe the image you want").
- **`purchase` gained one parameter**, `buyer_input: str = ""`.
- **Combination logic (`_combine_prompt(description, buyer_input)`):** whenever `buyer_input` is
  non-empty, the spawned order's prompt becomes the listing's description followed by
  `"Buyer-specified request: {buyer_input}"` -- the provider's description is kept as framing
  context ahead of the buyer's text. A blank `buyer_input` always falls back to the description
  unchanged.

**Buyer input is always optional, for every listing, regardless of `requires_input`** -- this
was NOT the original design and is itself a follow-up fix. The flag originally hard-gated
`purchase` (`[EXPECTED] this listing requires buyer-supplied input` on a blank `buyer_input`
when the flag was set) and hid the input field in the UI entirely when the flag was unset. Two
real bugs came from that: a provider whose description clearly needs customization but who
forgot to set the flag left buyers with no on-chain way to supply anything at all; separately, a
listing that wasn't flagged silently *ignored* any buyer input that was supplied anyway, since
`_combine_prompt` used to check `requires_input` before deciding whether to combine at all. Both
are fixed by removing `requires_input` from `purchase`'s validation and from `_combine_prompt`
entirely -- the flag is now UI guidance only (which hint text a buyer sees at checkout), never
an enforced requirement, and every listing's confirm-purchase dialog always shows the optional
input field.

- **Frontend (Task 3, still applies):** the Buy Now / Confirm Purchase dialog (both
  `listings/browse` and the listing detail page) re-disables Pay if the exact same input that
  just failed is resubmitted unchanged -- a buyer can no longer pay for a request that's already
  known to fail. It no longer disables Pay for a merely-empty field, since that's a valid choice
  now for any listing.
- **Honest post-payment failure handling (Task 4, unchanged):** once `purchase()` itself has
  finalized on-chain, a failure in the automatic generate/deliver/adjudicate pipeline is a
  genuine post-payment failure, not a purchase failure or a clause-adjudication result. Both the
  demo-signing purchase route and the wallet-signed path always surface the resulting `orderId`
  even when the auto-fulfill step errors, so the buyer is never stranded on the browse page with
  an error and no way to find their paid-for order -- they land on `/orders/[id]` either way,
  which shows a distinct "payment succeeded -- automatic generation hit an error" banner (not
  the generic waiting copy) and the existing "Retry automatic fulfillment" button, which resumes
  safely from wherever the order's on-chain state actually is.

## 🔌 Adding a modality to an existing provider registration

`register_provider` was always create-only: `if sender in self.providers: raise ...`,
unconditionally, regardless of which modality the second call asked for. That's correct for
"don't let a wallet register twice," but it also meant a provider registered for IMAGE who
later wanted to offer TEXT had no on-chain path to do it -- `register_provider(["TEXT"])`
would just be rejected as a duplicate registration, and `create_listing` for TEXT would
separately reject with "provider not registered for modality 'TEXT'." Both errors were real
and both were correct given the code at the time; the gap was that there was no third method
to reconcile them.

- **`add_modality(modality: str)`** is that method: requires an existing registration (raises
  if the sender isn't registered at all -- register first), rejects an unknown modality string,
  and rejects a modality the provider already holds. Otherwise it appends the modality to the
  provider's existing `modalities_json` list. `register_provider` itself was not modified.
- **Frontend (`providers/register`):** the registration page now checks whether the connected
  wallet already has a registration (`useProvider`). If not, it behaves exactly as before. If it
  does, already-held modalities render as locked/checked with an "already registered" badge,
  the submit button relabels to "ADD MODALITY," and confirming calls `add_modality` once per
  newly selected modality (signed sequentially by the same wallet) instead of retrying
  `register_provider`.

## 🤖 Auto-derived clauses (no manual clause authoring)

The TYPE/VALUE_FIELD/WEIGHT Clause Builder form is gone entirely, for both providers and
buyers -- nobody types a clause by hand anywhere in the UI anymore. Clauses themselves haven't
gone away: every order still gets real, closed-type-system clauses (the exact same
`must_contain`/`must_not_contain`/`must_match_format`/`must_use_only`/`must_mention`/
`must_not_mention` enum, validated by the exact same `_validate_clause_shape` -- factored out
of the pre-existing `_validate_clauses` unchanged in behavior). Only *where they come from*
changed.

**Layer 1 -- baseline modality clause (`_baseline_modality_clause`):** a fixed clause per
modality, contract-authored, always prepended to a listing's stored clauses by `create_listing`
itself. Never supplied by a caller, never derived, never editable -- the exact same check every
single time for every listing of a given modality. Constrained by what the existing (untouched)
adjudication mechanism can actually evaluate: `_fetch_artifact` decodes the delivered bytes as
UTF-8 text unconditionally, for every modality -- for TEXT that's the real content, but for
IMAGE/AUDIO (genuine binary files) that decode produces mostly non-printable noise, not a real
description of pixels or audio. The baseline clause is honest about that constraint: it checks
whether the decoded content is non-empty and doesn't read as a plain error/placeholder message
(a gateway timeout, an HTML error page, a JSON error body -- all of which decode as coherent
readable text regardless of the real modality), as opposed to either real prose (TEXT) or real
encoded binary noise (IMAGE/AUDIO). It does not and cannot claim to verify that an image
depicts any particular subject -- no clause system built on top of the current fetch mechanism
could, whether hand-typed or derived.

**Layer 2 -- auto-derived content clauses:** 1-2 real clauses generated by the shared backend
(`provider-service/lib/derive-clauses.ts`, a new Gemini call, exposed at `POST /api/derive-clauses`
and proxied for the browser at `/api/provider-service/derive-clauses`) from the provider's
plain-language listing description at listing time, plus up to 2 more from the buyer's own
optional purchase-time input (see "Buyer input on purchase" above -- the same text still also
feeds the generation prompt via `_combine_prompt`; this is additive, not a replacement). Never
throws: for TEXT, an LLM failure or missing API key falls back to a single generic
`must_match_format` clause when the caller needs a guaranteed non-empty result (a listing's own
content clauses), or to no extra clause at all when it's optional (buyer-input clauses). For
IMAGE/AUDIO, no content clause is ever produced -- fallback included -- regardless of whether
one is requested; see "IMAGE/AUDIO clause fix" below for why. `create_listing`'s clause
parameter is renamed `content_clauses` to make clear it's Layer 2 only; `purchase` gained
`buyer_clauses: list[dict] | None = None`, capped at 2 and validated per-clause the same way,
combined with the listing's own stored clauses (baseline + content) only for that specific
order -- the listing itself is never modified by a buyer's purchase.

**Frontend:** `listings/new` no longer has any clause UI -- description, modality, and price
only. Clicking "Review & List" triggers derivation once and shows the *exact* clauses that will
be submitted, read-only (the baseline clause plus whatever came back), before the provider
commits -- transparency without authoring. The same cached result is reused for the actual
`create_listing` call rather than re-deriving (LLM output isn't perfectly deterministic between
calls). The buyer-input field at purchase is unchanged in the UI; derivation for it happens
once, silently, right before the purchase transaction is signed.

**Verdict screen:** completely untouched. `get_job`/`get_order`'s shape, `clause_verdicts`, and
the Delivery & Verdict page's rendering are all exactly as before -- they were already generic
over however many clauses a job happens to have, so this needed zero changes to keep showing
genuine, real per-clause pass/fail evidence.

### Clause quality fix -- exact-phrase clauses and generic-clause dilution

A real order surfaced two derivation-quality problems, not contract bugs (the adjudication
mechanism correctly evaluated the clauses it was given -- the clauses themselves were bad): a
buyer asked for a biryani recipe, and derivation produced `must_contain: "biryani recipe"`
(failed -- a genuine, substantive recipe almost never contains that literal phrase) alongside
`must_mention: "invitation to ask questions"` (passed, but irrelevant -- clearly pulled from the
listing's own generic pitch, not the buyer's actual request).

- **Exact-phrase misuse:** `derive-clauses.ts`'s prompt now explicitly teaches the model that
  `must_contain`/`must_not_contain` require a verbatim string match and are almost never
  correct for open-ended, substance-based requests (a recipe, an essay, a description) --
  `must_mention` (genuine topic reference, any wording) or `must_match_format` (a structural/
  completeness requirement) are the default choices now, with concrete few-shot examples baked
  into the prompt (abstract instructions alone weren't reliable enough on their own -- verified
  empirically; adding worked-example input/output pairs is what actually fixed it).
- **Generic listing clauses diluting a specific buyer request:** a listing's own stored clauses
  are fixed forever once created (reusable-listing design, and this fix explicitly does not
  touch adjudication or contract logic) -- they can't be retroactively edited or dropped at
  purchase time. Instead: (a) buyer-input derivation now receives the listing's description as
  background *context*, explicitly instructed to treat the buyer's specific text as more
  important and never let a vague/generic background suppress a real requirement the buyer's
  own text clearly contains; (b) buyer-derived clauses are now forced to weight 3 (`forceWeight`
  in `deriveClauses`), deliberately outweighing the listing's own more generic content clauses
  in the release-fraction math, since the buyer's specific ask is the actual thing they paid
  for. The generic listing clause still exists and still gets evaluated (unavoidable without a
  contract change), but no longer dominates the practical settlement outcome.
- **Vague/generic descriptions no longer get restated verbatim as a clause:** the same
  low-signal-input problem could also happen at listing time (a generic provider pitch with no
  real topic). The prompt now explicitly tells the model to produce a generic substantive-
  response quality check instead of restating the sentence, and the zero-LLM-dependency
  fallback clause (used only when derivation is fully unavailable) was changed from
  `must_mention: <raw text>` to the same generic quality check, since restating arbitrary
  provider/buyer text verbatim as an exact clause value could itself be nonsensical.
- **Verified:** empirically, via the model directly (bypassing the app) -- with a fresh quota
  available, the exact biryani scenario (buyer text "a biryani recipe" + generic listing
  context "I write custom recipes for any cuisine, just ask") correctly produced
  `must_mention: "biryani"` (not `must_contain`, not diluted by the generic context). Production
  (`gemini-3.6-flash`, the model this project has used throughout) hit its own free-tier daily
  quota (20 requests/day) partway through this verification -- confirmed via the raw API error,
  not assumed -- so this specific confirmation used a different model as a pass-through check of
  the prompt logic itself, not a change to the actual configured model.

### IMAGE/AUDIO clause fix and delivered-content display

Two real bugs surfaced from an actual IMAGE order (a One Piece Roronoa Zoro anime portrait):
the delivered image was genuinely correct, but its content clauses failed anyway, and there was
no way to actually see the image on the order page short of trusting a link that turned out to
be pointed at the wrong place.

**Bug 1 -- IMAGE/AUDIO content clauses can never pass, by construction:** `_fetch_artifact`
decodes every delivered artifact as UTF-8 text regardless of modality (see "Auto-derived
clauses" above) -- correct for TEXT, but for IMAGE/AUDIO that's real binary bytes decoded into
mostly non-printable noise. A semantic clause (`must_mention`, or even the generic
`must_match_format` "substantive response" fallback) checked against that noise can never
honestly pass: the Zoro order's real delivery failed both "must mention Roronoa Zoro" AND the
generic fallback clause, purely because JPEG bytes aren't readable prose, not because anything
was actually wrong with the image. This isn't a quality problem fixable by a better prompt --
the check itself is unanswerable for binary content under the current fetch mechanism.
- **Fix:** `deriveClauses()` (`provider-service/lib/derive-clauses.ts`) now returns `[]`
  unconditionally for any modality other than TEXT -- no LLM call, no fallback clause, regardless
  of `guaranteeFallback`. This applies to both listing-time derivation and buyer-input-time
  derivation, since a buyer's own descriptive text is exactly as unable to be checked against
  binary bytes as a provider's.
- **Contract change:** `_validate_clauses` gained a `min_len: int = 1` parameter;
  `create_listing` now calls it with `min_len=0`, so an empty `content_clauses` list is accepted.
  The contract's own `_baseline_modality_clause` -- unaffected by this fix, still a real
  format/binary-data check -- is the only clause an IMAGE/AUDIO listing gets. TEXT listings are
  completely unaffected: `deriveClauses()` still produces 1-2 real content clauses for them
  exactly as before, and `create_listing`'s `min_len=0` is simply never a binding constraint
  when content clauses are non-empty.
- Deliberately not attempted: faking semantic image/audio understanding through the existing
  text-decode path. If genuine image/audio content checking is wanted later, it needs a real
  vision/audio-capable evaluation path -- out of scope for this fix, which only removes a check
  that could never have been honest in the first place.

**Bug 2 -- delivered content was never actually shown to the buyer:** the "view delivered
artifact" link built its gateway URL as `https://ipfs.io/ipfs/${cid}` unconditionally
(`genlayer-server.ts`'s `mapChainJobToUiJob`). Investigated rather than assumed: both that URL
and the correct one resolve successfully for a real delivered CID (confirmed directly --
`ipfs.io` and `gateway.pinata.cloud` both returned `200`, correct `Content-Type`, and
`Access-Control-Allow-Origin: *` for a real image CID), so the failure wasn't a dead gateway --
it was two separate correctness problems: (a) `ipfs.io` is a third-party public gateway that has
to discover pinned content via DHT/bitswap rather than a domain guaranteed to actually have it,
where `gateway.pinata.cloud` is literally where `pinToIPFS` uploads the bytes in the first place
and is what it already returns as its own `gatewayUrl` at delivery time -- reads should agree
with that instead of re-deriving a different, less authoritative URL from the bare cid; (b) one
early test order's "cid" was actually a raw `data:` URI (see the auto-derived-clauses section's
order #0 note), and concatenating that onto an `/ipfs/` path produced a URL that could never
resolve at all. Separately, content was only ever displayed via that single external link --
never rendered on the page itself, and only reachable once an order reached a settled/disputed
state, not as soon as delivery completed.
- **Fix:** a new `gatewayUrlFor(cid)` helper in `genlayer-server.ts` returns
  `https://gateway.pinata.cloud/ipfs/${cid}` for a real CID, or the `cid` unchanged if it's
  already a `data:` URI. A new `ArtifactViewer` component (`web/components/ArtifactViewer.tsx`)
  renders the delivered content inline based on modality: `<img>` for IMAGE, `<audio controls>`
  for AUDIO, and for TEXT a client-side fetch of the gateway URL rendered as plain text (TEXT
  content was never stored on the `Order` object itself, only its cid). Wired into both the
  order detail page -- visible as soon as `order.cid` is set, i.e. at `Delivered`, genuinely
  before adjudication runs, not gated behind a verdict -- and the verdict page (both desktop and
  mobile layouts).
- **Confirmed independent of adjudication:** a real order was purchased and delivered but
  deliberately left un-adjudicated (`submit_delivery` called, `adjudicate` withheld) --
  confirmed `state: Delivered`, `clause_verdicts: []`, and the order detail page already
  rendering the delivered image inline at that exact point, before any verdict existed.
- **Confirmed fixable for pre-existing orders:** Bug 2's fix is a pure display-layer change with
  no dependency on which contract version delivered the content, so it was checked directly
  against the **previous** live contract address (`0x883AC5...`, still live at the time of this
  check) on the real Zoro order (#7) -- its image now renders correctly inline on the verdict
  page. Its old clause verdicts remain exactly as they were (2 of 3 failed, for the Bug-1 reason
  above) -- those are **not** retroactively fixable, the same constraint hit by the earlier
  clause-quality fix (a listing's stored clauses are fixed forever once created), and this was
  confirmed directly rather than silently promising a fix that isn't possible. Only the display
  improved; the settlement outcome for that specific historical order is unchanged.

## ⏱️ Appeal window default

Two real orders showed appeal windows in the 15-20+ minute range when checked, which read like
a real per-order difference but wasn't one: `appeal_window_seconds` is set per listing at
`create_listing` time (the contract has no built-in default -- it's a required parameter), and
every listing created through the UI up to this point got the same value because
`lib/chain-client.ts` and the demo API routes all fell back to the same hardcoded `?? 3600` (one
hour) whenever the caller didn't specify one -- which the UI never did. The two different
"minutes remaining" observations were purely a function of when each order happened to be
checked relative to its own identical 1-hour window, not a real duration difference (confirmed
directly: both listings involved stored `appeal_window_seconds: 3600`).

One hour doesn't fit a marketplace built around small (sub-1-GEN), fast AI-generation purchases
-- long challenge windows make sense for systems securing large value over long timeframes, not
here. Changed the shared default to **180 seconds (3 minutes)**, via a single new constant
(`web/lib/constants.ts`'s `DEFAULT_APPEAL_WINDOW_SECONDS`) imported everywhere the old literal
`3600` appeal-window fallback appeared (`lib/chain-client.ts`'s `createListing` and legacy
`createJob`, and both matching demo API routes) -- a UI default, not a contract limit, so a
listing can still be created with a longer or shorter window by passing one explicitly; nothing
enforces 3600 or 180 as a hard floor/ceiling on-chain. Verified directly: a fresh listing created
through the live demo route shows `appealWindowSeconds: 180`; a real purchase → delivery →
adjudication on that listing settled with `appeal_deadline` exactly ~180s (182s observed, the
gap being script-side timing overhead, not a real discrepancy) after adjudication.

## ⚙️ Gemini quota handling, retry reliability, and localnet status

Real usage surfaced a stuck paid order (payment confirmed, generation failed on a Gemini quota
error, and "Retry automatic fulfillment" itself then failed with an unrelated raw RPC error) --
three distinct things needed sorting out, not one.

**The actual quota, confirmed rather than assumed:** the real 429 names the quota explicitly --
`GenerateRequestsPerDayPerProjectPerModel-FreeTier, limit: 20, model: gemini-3.6-flash`. This is
a **daily** cap (the quotaId literally says "PerDay"), not the short per-minute burst limit the
error's own "retry in ~10s" hint might suggest -- a short backoff genuinely cannot fix it, since
the quota won't replenish that fast. 20 requests/day is too low for this app's real usage: a
single order can involve up to three separate Gemini calls (listing-time clause derivation,
purchase-time buyer-clause derivation, actual content generation), so the quota caps out well
under 10 orders/day before every later purchase fails outright.

**The fix (`provider-service/lib/gemini.ts`):** confirmed empirically (not assumed) that
`gemini-2.5-flash` and `gemini-flash-latest` both had available capacity at the exact moment
`gemini-3.6-flash`'s own quota was fully exhausted -- Google scopes this quota per
(project, model), so a different model is a genuinely separate pool, not the same bucket under
another name. `callGeminiWithFailover` (shared by `generateText` and `derive-clauses.ts`, since
both hit the same quota) now handles two distinct failure modes differently:
- **Daily quota exhaustion** (a real `RESOURCE_EXHAUSTED`/429) -> immediately fails over once to
  `FALLBACK_MODEL` (`gemini-2.5-flash`) rather than wasting time retrying a wall that won't move.
- **Genuinely transient overload** ("This model is currently experiencing high demand" and
  generic 5xx, a real, different error also observed against this API) -> a short bounded
  backoff retry (3 attempts) against the *same* model, since this really does clear up within
  seconds, unlike the daily cap.

Verified under real, natural quota pressure (not simulated): 5 consecutive real
`derive-clauses` calls with `gemini-3.6-flash`'s quota already exhausted -- all 5 succeeded via
automatic failover to `gemini-2.5-flash`, confirmed in the logs (`Gemini primary model
gemini-3.6-flash's quota is exhausted, failing over to gemini-2.5-flash`) and in the actual
clause output quality. A fresh full order (listing -> purchase with buyer input -> generation ->
delivery -> adjudication) also hit the exhausted primary quota mid-flow and completed cleanly
via the same failover, settling `Released` at 100%.

**"Retry automatic fulfillment" itself failing (`lib/rpc-retry.ts`):** a separate, real bug --
the log showed a plain `GenLayer RPC error (gen_call): fetch failed`, Node's raw network-level
error (a connection reset, timeout, or DNS hiccup), not a Studio "busy" response. `withBusyRetry`
only ever pattern-matched Studio's specific `server busy`/`rate limit exceeded` text, so a
generic network-level failure was rethrown on the very first attempt instead of being retried --
the single worst place for that to happen, since this *is* the recovery path. Broadened the
match (`TRANSIENT_NETWORK_PATTERN`) to also cover `fetch failed`, `ECONNRESET`, `ECONNREFUSED`,
`ETIMEDOUT`, `EAI_AGAIN`, `ENOTFOUND`, and `socket hang up` (message and `.cause` chain both
checked). Safe to retry unconditionally: `withBusyRetry` is only ever used to wrap idempotent
reads and receipt-status polling in this codebase, never a write submission itself, so there's
no double-submission risk.

**Localnet migration status -- confirmed directly, not assumed: still not done.**
`web/.env.local` still targets `studionet`; nothing listens on `localnost:4000` (localnet's
port); Docker is not installed. Retested GLSim (the no-Docker option flagged in the earlier RPC
research) directly against this exact contract: it reproduces the same `[WinError 32] The
process cannot access the file because it is being used by another process` failure as before --
confirmed persistent and reproducible, not a one-off, and appears to be a genuine Windows
compatibility bug in the `genlayer-test[sim]` package itself, not something fixable from this
project's application code. Full local Studio (`genlayer up`) remains blocked on installing
Docker Desktop, a substantive system-level change not made without explicit confirmation first.
Separately, the actual root cause of the retry failure turned out to be independent of which
network is in use (the pattern-matching gap above would happen identically on localnet) --
so localnet's incompleteness was not, in fact, the cause of that specific bug, even though
finishing the migration remains a good idea for its original purpose (stopping local dev/test
traffic from competing with real users for Studio's shared quota).

## ⏩ Speed, release-balance safety, real pipeline progress, post-release appeal

No contract change in this round -- Issue 4 below concluded the contract was already correct,
and the other three issues are purely application-layer (progress display, a UI confirmation
pattern, and timing). The live contract address above is unchanged.

### Issue 1 -- where the 4-5 minute post-payment wait actually goes

Measured directly rather than assumed, via timing instrumentation added around each real await
in `autoFulfillOrder` (`lib/genlayer-server.ts`), on a real fresh IMAGE order:

| Stage | Duration | Share |
|---|---|---|
| Generate + pin (provider-service, one bundled call) | ~10.1s | ~8% |
| `submit_delivery` (write + wait for finalization) | ~42.0s | ~32% |
| `adjudicate` (write + wait for finalization -- real multi-validator GenVM consensus, including the LLM clause evaluation itself) | ~80.0s | ~60% |
| **Total** | **~132s (~2.2 min)** | |

The two on-chain steps together are ~92% of the total, and `adjudicate` alone is the single
largest cost by a wide margin -- that's real validator consensus genuinely evaluating clauses
against the delivered artifact, which is the actual product this app is selling; shortening it
would mean weakening consensus (fewer validators, skipping real LLM evaluation), not removing
overhead. Off-chain generation+pinning is comparatively minor. The polling loop itself
(`waitFinalized`, 3s interval) adds at most one interval's worth of "found out late" slop on top
of however long the real write actually took to finalize -- a few seconds out of a 42s or 80s
step, not a meaningful lever, and tightening it further trades a marginal latency win against
more load on Studio's shared, rate-limited node (a real constraint documented above). The
original "4-5 minutes" estimate is plausible under worse validator/LLM latency than this run hit
-- consensus timing genuinely varies -- but the breakdown's shape (adjudicate dominates,
generation is minor, polling overhead is negligible) is the stable, structural answer.

### Issue 2 -- Release Balance gave no immediate feedback, risking duplicate transactions

Same root cause already fixed once for Accept Job (`jobs/[id]/page.tsx`'s `handleAccept`): a
real transaction can be sent and then error out for *us* (network hiccup, our own wait timing
out) without that meaning the contract call itself reverted -- releasing a UI lock on the error
alone is what let a second real transaction race the first. Reused that exact pattern rather
than solving it from scratch:
- `claimSettlement` (`lib/chain-client.ts`) gained an `onSubmitted` callback, mirroring
  `acceptJob`, firing the instant a real transaction has actually been sent (or, for the demo
  signing path, the instant the request that will trigger one is sent).
- `orders/[id]/verdict/page.tsx`'s `handleRelease` now uses the same `tx-lock.ts`
  persists-across-remounts lock, tracks whether a transaction was actually `submitted`, and on
  an ambiguous error re-checks a **fresh read's `settled` field** (not just `state`, which was
  already Released/PartiallyReleased/Refunded before the click) before deciding whether it's
  safe to unlock -- `settled` flipping to `true` is the only thing that actually proves the
  payout went through. A confirmed `[EXPECTED]` rejection (e.g. "settlement already claimed")
  still unlocks immediately, same as Accept Job.
- Verified directly: clicking Release Balance shows a disabled "Claiming..." state within
  ~200ms (screenshot), and a rapid second click while the first is genuinely still in flight is
  blocked outright (Playwright's own click times out trying to find a re-enabled button).
  Separately confirmed the contract's own `if job.settled: raise` guard is what backstops this
  regardless of UI state: a direct repeat `claim_settlement` call against an already-claimed
  order was rejected with `[EXPECTED] settlement already claimed`; a deliberately-fired pair of
  *genuinely concurrent* `claim_settlement` calls from the same account resolved to the exact
  same transaction hash (Studio/genlayer-js coalesce identical concurrent calls from one
  account rather than racing two separate ones) -- no double-payout in either case. As with the
  Accept Job pattern this is copied from, the lock is client-local (localStorage) and protects
  one browser tab/session against itself, not two independent sessions clicking at the same
  literal instant -- that's the same accepted scope the original fix has, not a new gap.

### Issue 3 -- real stage-by-stage progress, not a generic spinner

Replaced the single static "auto-generating..." message with a live checklist reflecting the
pipeline's actual real stages, backed by real signal rather than a timer:
- `lib/fulfill-progress.ts`: a small in-memory, per-process stage map (`generating` |
  `delivering` | `consensus`), set by `autoFulfillOrder` itself at the exact point each real
  await starts -- not a separate simulated progression. In-memory and per-server-process is a
  deliberate, small-scale tradeoff already made elsewhere in this app (`tx-lock.ts`'s
  localStorage-based lock is the same kind of choice) -- fine for a single local dev server, not
  meant to survive a restart.
- New `GET /api/chain/orders/[id]/fulfill-progress`, polled every ~1.2s by a new
  `components/PipelineProgress.tsx`, wired into both the order detail page (visible the moment
  `order.cid` exists, i.e. `Delivered`, same as the artifact viewer -- not gated behind
  adjudication) and the purchase confirm modal on `listings/browse` (for the wallet-signed path,
  which is the only path where the order id is known early enough to poll during the wait; the
  demo-signing fallback bundles purchase+fulfillment into one opaque blocking call with no
  intermediate signal available without changing that route's request/response contract, so it
  keeps its existing single accurate message rather than faking a split it can't back).
- **Honest limitation, stated rather than hidden:** "generating" and "pinning to IPFS" are one
  bundled real stage from this app's vantage point, since `provider-service`'s `/api/generate`
  returns both together in one request/response and this fix doesn't change that contract (per
  the project's existing "provider-service is wired into as-is" convention). The checklist shows
  one real "Generating & pinning content" row rather than two, since splitting it further isn't
  something this app can actually observe -- faking that split with a timer is exactly the kind
  of decorative-not-real progress the task ruled out.
- Verified on a real IMAGE order purchased directly against the chain (bypassing the app, to
  leave it sitting in `Accepted` with nothing yet triggered) and then driven via a real click on
  "Retry automatic fulfillment": screenshots show the checklist correctly at "Generating &
  pinning content" (active), then "Submitting for delivery" (active, prior step ticked), then
  "GenVM consensus in progress" (active, prior two ticked) -- genuine stage transitions tied to
  the same real awaits Issue 1's timing numbers above came from, not animation.

### Issue 4 -- Appeal after release/claim

Checked the actual contract logic rather than assuming a gap needed filling. `appeal()`'s only
timing guard is `if now > job.appeal_deadline: raise "appeal window has closed"`, checked
unconditionally regardless of `job.settled`. `claim_settlement()`'s only timing guard is the
complementary `if now <= job.appeal_deadline: raise "appeal window still open"`. Both check the
exact same stored `job.appeal_deadline` value, and time only moves forward -- so the instant
`claim_settlement` has ever succeeded once (which requires the deadline to have already passed),
`appeal()`'s own check is *permanently* and unconditionally false from that point on. **The
contract already fully prevents appealing a released settlement; no contract change was
needed.** Confirmed directly rather than assumed: `claim_settlement` on a real settled order
succeeded (`settled` flipped `true`), and an immediately-following `appeal()` attempt on that
same order was rejected with `[EXPECTED] appeal window has closed`.

The real gap was the **frontend** leaving the Appeal Verdict button clickable regardless (only
disabled while `state === "Disputed"`), meaning a click after the window closed would reach the
contract and get a correct-but-late rejection instead of the button simply reflecting that
reality up front. Fixed in `orders/[id]/verdict/page.tsx`: the button (both desktop and mobile)
is now also disabled once the appeal deadline has passed or `order.settled` is true (the
contract's own `get_job.settled` field, now surfaced on the `Job`/`Order` type), with a plain
on-page reason ("Appeal window has closed" / "Settlement already claimed -- nothing left to
appeal") replacing the silent no-op.

## 👛 Wallet address display: overflow + accidental disconnect

Two real display/interaction bugs, no wallet-connect signing logic touched:

- **Overflow:** the sidebar identity block rendered the connected wallet's full raw address in
  a `<p>` with no truncation and no `min-w-0` on its flex-row container -- a classic flex/
  truncate gotcha (a flex child won't actually shrink/ellipsize no matter what CSS the text
  itself has unless its container is allowed to shrink below its content size). Fixed by
  truncating to the same `0x1234...5678` form already used correctly by the top-nav chip, and
  adding `min-w-0` to the flex child.
- **Accidental disconnect:** the top-nav wallet chip wired its entire connected-state button
  straight to `disconnectWallet` -- a single click, no confirmation, easy to trigger by accident.
  Replaced both places that show the connected wallet (top-nav chip and sidebar identity block)
  with one shared `components/WalletMenu.tsx`: clicking now only ever opens a small anchored
  popover (full address, copy-address button, explicit DISCONNECT button); disconnecting
  requires that second, deliberate click. Styled to match the app's existing hardware-border/
  mono-font card language rather than inventing a new visual pattern -- there was no existing
  anchored-popover component to reuse, only the centered `Modal`, which doesn't fit a small
  menu like this one. The sidebar uses a bare-text trigger variant (it already has its own
  icon/status row around it) while the top-nav keeps its existing pill-button look; both open
  the same popover content.
- Verified with a mocked EIP-1193 provider (simulates wallet-connect responses only, nothing
  touching real signing) driving the actual Connect Wallet UI flow: sidebar address renders
  fully inside its container with no overflow past the sidebar's right edge; clicking either
  the sidebar address or the top-nav chip opens the popover without disconnecting; the wallet
  only actually disconnects once the DISCONNECT button inside is clicked.

## 🌩️ New RPC failure shape: HTML instead of JSON

A third distinct failure mode surfaced across two unrelated features (List Service for an AUDIO
listing, Browse Listings), separate from both previously-diagnosed shared-RPC problems
(Studio's own "server busy: N execution slots occupied" JSON error, and the plain network-level
"fetch failed"). This one is `GenLayer RPC error (gen_call): Unexpected token '<', "<!DOCTYPE
"... is not valid JSON` -- something returned an actual HTML page where a JSON-RPC response was
expected.

**Confirmed rather than assumed:**
- Not a misconfigured URL in this app's own code -- checked every `createClient` call site
  (`genlayer-server.ts`, `genlayer-wallet.ts`) and `genlayer-js`'s own bundled `studionet` chain
  config directly; all correctly target `https://studio.genlayer.com/api`, no custom `rpcUrl`
  override anywhere.
- Confirmed live in this project's own server log: the exact same error hit `gen_call` reads
  across `get_job`/`get_listing`/`get_provider` -- i.e. every route that reads from the chain,
  not something specific to AUDIO or to Browse Listings -- correlating with a burst of heavy
  concurrent request volume from this project's own recent automated verification runs (multiple
  Playwright sessions, concurrent-read scripts, deploy scripts, all against the same shared dev
  IP in a short window).
- Confirmed structurally: `studio.genlayer.com/api` itself is fronted by Cloudflare (`Server:
  cloudflare`, a `CF-RAY` header on every response), and the bare domain (`studio.genlayer.com`,
  no `/api`) serves GenLayer's real marketing site -- genuine `<!doctype html>` content. The most
  likely explanation is a Cloudflare **edge**-level intervention (rate-limiting or bot
  mitigation, a layer in front of and separate from Studio's own application logic) serving
  Cloudflare's standard HTML page instead of forwarding to the JSON-RPC handler, under the
  request volume this project's own testing was generating -- distinct from Studio's own
  application-level "server busy" response, which is already handled.
- Could not force a fresh live reproduction at the moment of fixing this (a 15-request concurrent
  burst against `/api/chain/listings` and `/api/chain/jobs` just now came back clean) -- the
  triggering condition isn't currently active, and deliberately hammering Studio harder to force
  it isn't advisable given the same shared-quota concern documented earlier. The fix below is
  based on the real historical log evidence and the structural Cloudflare confirmation above, not
  a fresh in-the-moment repro.

**The actual bug, once the shape was identified:** `rpc-retry.ts`'s `isBusyError` didn't
recognize this failure shape at all -- its two existing patterns only match Studio's own "server
busy" text and generic network-level errors (`fetch failed`, `ECONNRESET`, etc.), neither of
which this is (the HTTP request itself succeeded; this is a `JSON.parse` `SyntaxError` on a body
that came back as HTML). Every affected read (`readJob`/`readListing`/`readOrder`/`readProvider`)
already goes through `withBusyRetry`, so this wasn't a missing-retry-wrapper problem -- it was a
pattern-matching gap identical in shape to the earlier `fetch failed` gap, just a third distinct
failure text. Fixed by adding a third pattern (`Unexpected token '<'`/`is not valid JSON`/
`<!doctype`) to `isBusyError`, so this now retries exactly like the other two transient shapes --
safe for the same reason both existing patterns already are (`withBusyRetry` only ever wraps
idempotent reads and receipt polling in this codebase, never a write submission).

### Is it time to revisit the localnet migration decision?

Asking plainly rather than deciding silently, per the task's own instruction. This is now the
**third** distinct manifestation of the same underlying root cause across this project's
history: Studio's shared, externally-operated RPC being unreliable under load that this
project's own dev/test activity meaningfully contributes to (`server busy` -> a retry-pattern
gap on plain network errors -> now a retry-pattern gap on Cloudflare-edge HTML pages). Patching
each new error shape as it appears is inherently reactive -- it does not reduce how much load
this project's own testing puts on the shared endpoint, only how gracefully each specific
symptom is handled once it happens.

**My honest read: the recurring cost now plausibly outweighs the one-time setup cost.** Docker
Desktop is a mature, well-documented, one-time install (commonly 10-20 minutes including a
restart) -- not an exotic ask. The lighter no-Docker alternative (GLSim) was already tried and
confirmed to have a reproducible Windows-specific bug (`[WinError 32]`, file-lock on contract
deploy) in an earlier session, so it isn't actually available as an easier middle path on this
machine -- the real choice is between continuing to absorb shared-RPC failures indefinitely, or
paying the Docker install once to get a private, unthrottled local target. Against that: the
public-deployment network decision is still separately unmade, so this wouldn't resolve the
eventual production RPC story either way, only local dev/test reliability.

**Decision (asked, not assumed):** flagged back to the user directly rather than deciding
silently either way. Answer: **staying on shared `studionet` for now** -- this specific
machine's hardware can't comfortably run Docker Desktop alongside everything else, which is a
harder constraint than "felt like a heavy ask" (the original reason migration was deferred
earlier). Local dev/test continues against the shared endpoint; the mitigation is the retry-
pattern fix above (and the two before it), not a network change. Revisit if either the hardware
constraint changes or this class of failure keeps recurring badly enough to outweigh it anyway.

## 🎙️ AUDIO capability: text-to-speech only, not music

A real listing on this contract (#4) reads "Ask me any audio or song remix, i could do it," and
a buyer who took that literally and asked for a song remix got back a spoken-word reading of
their own request text -- the model working exactly as designed, just not as the listing
implied.

**The actual model:** `provider-service/lib/cloudflare.ts`'s `generateAudio` calls Cloudflare
Workers AI's `@cf/myshell-ai/melotts` -- confirmed directly (not assumed) to be text-to-speech
only: it reads input text aloud in a synthesized voice. No melody, composition, or music
capability exists in this model at all.

**Investigated before changing anything, per the task:** Cloudflare's broader model catalog
(`developers.cloudflare.com/ai/models/`, a superset of the classic Workers AI product) does now
list two real music-generation entries -- MiniMax Music 2.6 (`minimax/music-2.6`, full songs
with vocals from lyrics/prompts, or instrumentals) and ElevenLabs Music v2 (`elevenlabs/music-v2`,
composes songs/instrumentals from a prompt). Whether either is usable under this project's
existing free setup was checked directly rather than assumed:
- That catalog page's own header states it covers "AI models available through Cloudflare,
  **including hosted models on Workers AI and external providers via AI Gateway**" -- i.e. it
  deliberately aggregates two different products: Workers AI's own hosted, Neuron-billed models
  (what this project actually uses), and third-party vendors reached only via AI Gateway
  pass-through (which requires *your own separate account and API key with that vendor* --
  Cloudflare doesn't host or bill for the third party's own inference).
- Both music models are tagged "Third-party" and show "View pricing in the Cloudflare dashboard"
  rather than the flat public per-unit rate every other model (including MeloTTS itself) has --
  neither appears anywhere in Workers AI's own public pricing table at all, unlike every other
  catalog model, first- or third-party alike.
- Confirmed empirically against Cloudflare's real REST API using this project's own real
  `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`: calling
  `POST /client/v4/accounts/{account}/ai/run/@cf/minimax/music-2.6` (and without the `@cf/`
  prefix) returned `{"success":false,"errors":[{"code":7000,"message":"No route for that URI"}]}`
  -- these models are not reachable through the classic Workers AI `ai/run/{model}` binding this
  project's `cloudflare.ts` already uses, at all, confirming they sit on the separate AI Gateway/
  BYOK surface rather than the free Neurons-billed product.

**Conclusion: no genuine free-tier path to real music generation exists within this project's
current Cloudflare setup.** Both real music models require a separate, dedicated paid account
with MiniMax or ElevenLabs directly -- exactly the kind of paid dependency this project has held
a strict line against since the start. **Task 2b applies, not 2a: the generation call is
unchanged; the fix is honesty about what's actually deliverable, not a fake capability claim.**

**What changed:** nothing in `cloudflare.ts` or the generation pipeline -- MeloTTS remains the
audio model, doing exactly what it already did. Fixed the places that could set a buyer's
expectations wrong instead:
- `listings/new`: the description field's placeholder is now modality-aware (a real
  TTS-appropriate example for AUDIO instead of the generic image-oriented one that gave no real
  guidance), and selecting AUDIO shows an explicit "AUDIO = TEXT-TO-SPEECH ONLY" notice before a
  provider writes their listing.
- `listings/browse`: every AUDIO listing card (desktop and mobile) now shows a
  "text-to-speech only -- spoken voice, not music/song" tag up front, and the purchase confirm
  modal repeats it plainly right before Pay -- regardless of what that specific listing's own
  description happens to promise (existing listings, like #4 above, can't be rewritten
  retroactively -- this protects buyers going forward on any listing, old or new, the same
  constraint already hit by earlier tasks' "can't fix old orders" notes).
- No contract change, no adjudication change -- this is pure listing/purchase-flow copy, exactly
  as scoped.

## 🩺 Global loading states, faucet link, and a broader UX/reliability pass

Frontend-only pass (no contract/adjudication changes) covering three things: making every
Studio read visually obvious while it's in flight, adding a verified faucet link, and finding/
fixing the same "no clear feedback" bug class this project has hit several times already
(Accept Job double-submission, Release Balance's unclear feedback) before it got reported again
one bug at a time.

**1. Loading states.** Every Studio read in the app previously rendered as a single line of
plain text ("[LOADING] Reading X from GenLayer Studio..."), easy to miss and indistinguishable
from a hung page. New shared `components/LoadingState.tsx` (bordered card, spinning icon, same
`animate-spin`/`text-primary` treatment `PipelineProgress`'s active-stage row already used) is
now wired into every Studio-read location found by a full-codebase audit:

  - Browse Listings (desktop *and* mobile grid, which previously had **no loading/error UI at
    all**), Listing detail, Order detail, Order appeal, Order verdict, Provider profile
    (including its transaction-history table, previously silent while loading), Provider
    registration (previously no indicator while checking existing registration), Buyer/Provider
    dashboards, Activity feed, and every legacy `jobs/*` equivalent (Browse Jobs desktop+mobile,
    Job detail, Job appeal, Job verdict).
  - Provider dashboard's trust-score card also got its own inline spinner (previously showed a
    bare `--` with no indication it was still loading vs. genuinely unavailable).

**2. Faucet link -- verified, not guessed.** Confirmed directly against GenLayer's own docs
(network-configuration page) before wiring anything in: Studionet (what this app actually runs
on) has **no separate faucet page or subpath** -- it's a built-in 💧 button inside Studio's own
account selector. The `testnet-faucet.genlayer.foundation` site that shows up in a search funds
a *different* network (Bradbury/Asimov), not Studionet, so that would have been the wrong link
entirely. Added a "NEED TEST GEN? OPEN STUDIO FAUCET" link (`https://studio.genlayer.com`,
opens in a new tab) inside `ConnectedWalletMenu` (`components/WalletMenu.tsx`), between the
address/copy block and Disconnect -- visible from both the top-nav chip and the sidebar identity
block, since both already share this one popover component.

**3. Reliability audit -- found and fixed:**

  - **Deactivate Listing** (`listings/[id]`) had no tx-lock and surfaced failures via a raw
    `alert()`. Now uses the same `acquireLock`/`isLocked`/`releaseLock` pattern as Purchase on
    the same page, with an inline error banner instead of a blocking native alert.
  - **List a Service** (`listings/new`) and **Provider Registration / Add Modality**
    (`providers/register`) had no lock protecting their multi-transaction submissions across a
    remount. Both now lock by wallet address (no listing/job id exists yet at submit time).
    Registration's `add_modality` loop (one tx per newly selected modality) now also shows
    per-iteration progress ("Registering modality 2 of 3 (AUDIO)...") instead of one static
    "SUBMITTING..." for the whole multi-transaction stretch.
  - **Appeal** (both `orders/[id]/appeal` and the legacy `jobs/[id]/appeal`) and **Resolve
    Appeal** (`orders/[id]`'s re-adjudicate action) had no lock at all. Both now use the same
    lock pattern as Release Balance/Accept Job.
  - **Legacy `jobs/[id]/verdict`'s Release Balance had no lock whatsoever** -- the exact same
    bug class already fixed once for the `orders/*` flow (a remount shows "Release Balance"
    clickable again while an earlier real `claim_settlement` is still finalizing) was never
    backported to this still-reachable legacy route. Fully backported: lock +
    `isDefiniteRejection` + fresh-read `settled` reconciliation, identical to
    `orders/[id]/verdict/page.tsx`.
  - **Four raw `alert()` calls** used as the *only* error surface for a write failure --
    `listings/[id]` deactivate, `dashboard/provider` submit-delivery, legacy `jobs/browse`
    accept, legacy `jobs/new` create+fund -- all replaced with the same inline
    `[ERROR] {message}` convention already used everywhere else in the app (new shared
    `components/ErrorBanner.tsx`, not a new pattern).
  - **Stale data after an action that should have changed it, in two places:**
    - `orders/[id]`'s auto-fulfill checklist (`PipelineProgress`) could reach "Verdict ready"
      while the order badge above it still read the stale "PAID -- AUTO-FULFILLING" until a
      manual reload. `PipelineProgress` now takes an `onComplete` callback, fired once when the
      poll first observes the pipeline finished, wired to the existing `refetch()` the page
      already had (no new fetch logic).
    - Every dashboard/list read hook in `lib/chain-client.ts` (`useJobs`, `useJob`,
      `useProvider`, `useListings`, `useListing`, `useOrders`, `useOrder`) fetched exactly once
      on mount and never again -- a settlement or purchase completed elsewhere (another tab, or
      this app's own auto-fulfill pipeline finishing after the user navigated away) wouldn't
      show up without a manual reload, directly contradicting the buyer dashboard's own
      "LIVE_SYNC_ENABLED" indicator. Added one shared `useRefetchOnFocus` helper (window
      `focus` + `visibilitychange` listener) used by every hook, instead of a bespoke polling
      hack per page.

**Flagged, not fixed** (same "surface, don't silently decide" spirit as earlier tasks -- these
are honesty/dead-code issues, a different category from the "no feedback" bugs Task 3 actually
asked for):
  - The legacy `jobs/*` flow (Browse Jobs → Accept → Deliver → Adjudicate) is fully live and
    reachable by direct URL even though no nav link points to it anymore, and its sidebar still
    reads `Network: Mainnet-Alpha` (missed by the earlier landing-page mainnet-copy fix, since
    that task explicitly excluded App Shell/post-wallet pages). Worth a decision: delete these
    routes, redirect them to the `orders/*` equivalents, or keep them as-is.
  - Both Appeal pages (`orders/[id]/appeal`, `jobs/[id]/appeal`) render hardcoded fake
    "Disputed Clause(s)" checkboxes and a reasoning textarea that is captured in state but never
    actually sent to the contract -- cosmetic-only content unrelated to the order/job's real
    clauses. `ATTACH_LOG_FILE`, `LINK_REPOSITORY`, `SAVE_DRAFT_AND_EXIT`, and the
    `COURT_PROTOCOL_V4.2` link are all non-functional.
  - `providers/register`'s `DISPLAY_NAME` input has no `value`/`onChange` -- anything typed
    there is silently discarded on submit.
  - `providers/[id]`'s `INITIATE_HIRE`/`SEND_MESSAGE` buttons have no handlers.
  - Several dashboard/footer stats are hardcoded fiction presented as live data (buyer
    dashboard's `[STABILITY] 99.8%`/`[NODES] 1,402`/`[GAS_OPTIM] 14 GWEI`; provider dashboard's
    `Network Load`/`Block Height`/the "Operator Logs" terminal panel; legacy Browse Jobs'
    "Network latency: 24ms" and fake pagination; the global footer's `[NETWORK_LATENCY: 24MS]`).
    None of this is wired to anything real.
  - `lib/mock-data.ts` (193 lines) is dead code, not imported anywhere.

## ✅ Release Balance stays clickable after settlement is already claimed

Small render-state fix on `orders/[id]/verdict/page.tsx`: once `order.settled` is true, Appeal
Verdict correctly disabled itself (via `appealDisabledReason`), but Release Balance right next
to it kept rendering as a normal active button -- nothing was actually wrong with clicking it
(the contract would just reject a genuine re-claim), but the UI invited a click on something
already done. Fixed by reusing the exact same `order.settled` check driving Appeal Verdict:
both desktop and mobile Release Balance buttons now also disable on `order.settled`, rendering
"Settlement Claimed" / "Claimed" with a check-circle icon at the same `disabled:opacity-50`
treatment Appeal Verdict already used -- no new pattern invented, no changes to the claim logic
or anything else on the page. Verified on a real already-settled order (`/orders/9/verdict`):
both buttons now show their confirmed/disabled state side by side.

## 🚨 Appeal page was showing leftover Stitch-mockup content, not real order data

**Investigation finding, reported plainly as asked:** Submit Appeal was NOT disconnected mock
UI -- `submitAppeal()` → `appealJob()` (`lib/chain-client.ts`) was already calling the contract's
real, payable `appeal(job_id)` function with the order's real `dispute_bond_atto` as the attached
value, protected by the same tx-lock pattern used elsewhere. The bug was entirely in the
*surrounding* content: leftover placeholder copy from the original Stitch export that was never
replaced with this product's real data, on both `orders/[id]/appeal` and the legacy
`jobs/[id]/appeal` (same file, duplicated). Specifically, per-item:

  - **"Disputed Clause(s)" checkboxes** showing fake "GPU-compute benchmarks" / "SLA <50ms
    latency" content unrelated to any real clause -- replaced with the order's actual
    `clauseVerdicts` (same data/styling as the Verdict page), shown read-only rather than as
    checkboxes: the contract's `appeal()` takes only a `job_id`, no per-clause selection, so a
    real re-adjudication always re-checks every clause -- checkboxes implying otherwise would
    themselves have been misleading.
  - **Bond amount** was already real (`order.disputeBondGen`, scaled `price * 1.5` at listing
    creation) -- the "3.00 GEN" the bug report flagged was correct given that order's price, not
    a placeholder. What *was* fake: a "NETWORK FEE" + "TOTAL COMMITMENT" breakdown bolted on top
    of the real bond. GenLayer Studio is gasless and `appeal()` requires the attached value to
    equal `dispute_bond_atto` *exactly* (`provider_court_escrow.py:715`) -- there is no separate
    fee. Removed, replaced with a plain "this bond is the only amount charged" note.
  - **"100% of the bond is burned if rejected"** was also factually wrong, confirmed by reading
    `resolve_appeal()` directly (`provider_court_escrow.py:721-749`): the bond is never burned --
    it's paid to the disputant if re-adjudication changes the outcome, or to the *other* party if
    it doesn't. Copy corrected to describe this real win/lose transfer.
  - **"Secondary audit by a randomized tier-2 validator cluster... 12-36 hours"** was entirely
    invented. Replaced with what actually happens: submitting `appeal()` only locks the bond and
    flips state to Disputed; a second real GenVM consensus round is triggered *separately* from
    the order detail page's own "Resolve Appeal" button, typically finishing in under a minute
    once triggered -- the same real adjudication mechanism used the first time.
  - **"READ COURT_PROTOCOL_V4.2"** linked to `href="#"` -- no real document exists. Removed.
  - **Reasoning/evidence textarea + ATTACH_LOG_FILE/LINK_REPOSITORY/SAVE_DRAFT_AND_EXIT** were
    all non-functional: the typed reasoning was captured in state but never sent anywhere
    (`appeal()` has no evidence/reasoning parameter to send it to), and the three buttons had no
    `onClick` at all. Removed rather than left implying functionality that doesn't exist.
  - A fake "Network Status: Online / Latency: 24ms" header widget (same fabricated-stat pattern
    flagged elsewhere in this project) was also removed and replaced with the order's real
    `appeal_deadline`.

**Verified end-to-end on real orders, not just read from code:** purchased a fresh listing,
waited for the real auto-fulfill pipeline to settle it, then used the Appeal page's actual
Submit Appeal button (order #14) -- confirmed via a direct on-chain read afterward that the
order genuinely moved to `Disputed` with its real 1.50 GEN bond locked. A separate attempt
against an order whose real 180s appeal window had already closed correctly surfaced the
contract's own `[EXPECTED] appeal window has closed` rejection through the existing error-banner
convention, rather than failing silently -- both are the *correct* real behavior for those two
cases, not evidence of a remaining bug.

## ⬅️ Back-navigation, added app-wide

There was no way to navigate back once landing on a deep page (Appeal was the one reported, but
the same gap existed on every listing/order/provider detail, verdict, and legacy job page).
Fixed centrally rather than per-page: new `components/BackButton.tsx` (uses real browser history
via `router.back()`, since this app's pages aren't reached through one uniform parent -- an
order can come from Browse Listings, a dashboard, or Activity, and history already knows which
one actually happened) is now rendered once by `AppShell.tsx` for every route that isn't one of
the top-level nav destinations (`TOP_LEVEL_ROUTES`), so every current and future "deep" page gets
it automatically instead of each page wiring its own. Verified working from four different deep
pages (listing detail, order detail, order verdict, order appeal), each correctly returning to
wherever it was actually navigated from.

## 🧩 What's decentralized vs. shared right now

This is a deliberate MVP scope decision, not a limitation of GenLayer or the escrow contract
itself:

- **Provider identity and payout are fully decentralized.** Any wallet can call
  `register_provider` for any modality (TEXT/IMAGE/AUDIO) at no cost beyond a Studio-gasless
  transaction — there is no bond, allowlist, or approval step in the contract. Any registered
  wallet can `accept_job` on a funded job matching its modality, and settlement pays out to
  that exact wallet address. Nobody needs permission from this app to participate as a buyer
  or a provider.
- **Provider infrastructure is currently one shared backend**, not something each provider
  brings themselves. Every accepted job's actual generation — Gemini for TEXT, Cloudflare
  Workers AI for IMAGE/AUDIO, Pinata for IPFS pinning — runs through this app's own API keys
  (`provider-service/`), regardless of which wallet accepted the job. There is no mechanism
  today for a provider to register their own model, endpoint, or credentials, and the
  registration UI doesn't ask for any.
- **Why this matters operationally:** since registering is free, and every accepted/purchased
  order triggers a real call against a quota-limited shared backend, the app enforces a
  concurrency cap before spending backend quota (`MAX_CONCURRENT_ACCEPTED_PER_PROVIDER` in
  `web/lib/genlayer-server.ts`, currently 3) -- keyed on the **provider** for the legacy
  free-to-accept flow (`countConcurrentAccepted`), and keyed on the **buyer** for the
  listings/`purchase` flow (`countConcurrentAcceptedByBuyer`), since purchasing is what
  triggers auto-generation now, not a provider's accept action. `purchase` itself also costs
  the buyer the listing's real price, a throttle the old free `accept_job` never had -- though
  that alone doesn't help if a listing is priced near-zero, which is why the concurrency cap
  still applies on top of it. Both are application-level guards, not contract changes — a
  determined attacker can still route around either with multiple wallets, so they raise the
  cost of casual abuse rather than eliminating the abuse surface outright.
- **Natural future direction:** real per-provider infrastructure (each provider running their
  own model/endpoint and being paid to call it, with the contract or app only routing jobs to
  them) is the obvious next step once there's demand for it — nothing about the contract's
  design assumes a shared backend, that's purely how the current reference frontend/service
  are wired.

## 📦 What's included
- Basic requirements to deploy and test your intelligent contracts locally
- Configuration file template
<!-- - Test functions to write complete end-to-end tests -->
- An example of an intelligent contract (Football Bets)
- Example end-to-end tests for the contract provided

## 🛠️ Requirements
- A running GenLayer Studio (Install from [Docs](https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup#using-the-genlayer-studio) or work with the hosted version of [GenLayer Studio](https://studio.genlayer.com/)). If you are working locally, this repository code does not need to be located in the same directory as the Genlayer Studio.

## 🚀 Steps to run this example

### 1. Configure environment
   Rename the `.env.example` file to `.env`, then fill in the values for your configuration. The provided values are the standard values for a tipical GenLayer Studio deployed locally.

### 2. Deploy the contract
   Deploy the contract from `/contracts/football_bets.py` using the Studio's UI:
   1. Open the GenLayer Studio interface in your web browser (usually at http://localhost:8080).
   2. Create a new file in the "Contracts" section and paste the content of `/contracts/football_bets.py` (the content is different than the existing contract from the examples).
   3. Navigate to the "Run and Debug" section.
   4. Follow the on-screen instructions to complete the deployment process.

### 3. Setup the frontend environment
  1. All the content of the dApp is located in the `/app` folder.
  2. Rename the `.env.example` file in the `/app` folder to `.env`.
  3. Add the deployed contract address to the `/app/.env` under the variable `VITE_CONTRACT_ADDRESS`

### 4. Run the frontend Vue app
   Ensure your GenLayer Studio is running, and execute the following commands in your terminal:
   ```shell
   cd app
   npm install
   npm run dev
   ```
   The terminal should display a link to access your frontend app (usually at http://localhost:5173/).
   For more information on the code see [GenLayerJS](https://github.com/yeagerai/genlayer-js).
   
### 5. Test contracts
1. Install the Python packages listed in the `requirements.txt` file in a virtual environment.
2. Make sure your GenLayer Studio is running. Then execute the following command in your terminal:
   ```shell
   gltest
   ```

## ⚽ How the Football Bets Contract Works

The Football Bets contract allows users to create bets for football matches, resolve those bets, and earn points for correct bets. Here's a breakdown of its main functionalities:

1. Creating Bets:
   - Users can create a bet for a specific football match by providing the game date, team names, and their predicted winner.
   - The contract checks if the game has already finished and if the user has already made a bet for this match.

2. Resolving Bets:
   - After a match has concluded, users can resolve their bets.
   - The contract fetches the actual match result from a specified URL.
   - If the Bet was correct, the user earns a point.

3. Querying Data:
   - Users can retrieve all bets.
   - The contract also allows querying of points, either for all players or for a specific player.

4. Getting Points:
   - Points are awarded for correct bets.
   - Users can check their total points or the points of any player.

## 🧪 Tests

This project includes integration tests that interact with the contract deployed in the Studio. These tests cover the main functionalities of the Football Bets contract:

1. Creating a bet
2. Resolving a bet
3. Querying bets for a player
4. Querying points for a player

The tests simulate real-world interactions with the contract, ensuring that it behaves correctly under various scenarios. They use the GenLayer Studio to deploy and interact with the contract, providing a comprehensive check of the contract's functionality in a controlled environment.

To run the tests, use the `gltest` command as mentioned in the "Steps to run this example" section.


## 💬 Community
Connect with the GenLayer community to discuss, collaborate, and share insights:
- **[Discord Channel](https://discord.gg/8Jm4v89VAu)**: Our primary hub for discussions, support, and announcements.
- **[Telegram Group](https://t.me/genlayer)**: For more informal chats and quick updates.

Your continuous feedback drives better product development. Please engage with us regularly to test, discuss, and improve GenLayer.

## 📖 Documentation
For detailed information on how to use GenLayerJS SDK, please refer to our [documentation](https://docs.genlayer.com/).

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
