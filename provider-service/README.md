# Provider Court — Provider Backend Service

Off-chain service that plays "Provider #1": generates the deliverable for an
accepted job (text/image/audio) and pins it to IPFS so the Intelligent
Contract's `adjudicate(job_id, cid)` can fetch it independently. This is a
plain Vercel serverless function project (no Next.js) — it's a pure backend,
called by whatever wires up the accept/deliver flow later.

## Step 0 research findings (verified live 2026-07-28)

| Service | Choice | Why |
|---|---|---|
| Text | **Gemini 3.6 Flash** (`gemini-3.6-flash`) | Released 2026-07-21, Google's current default/latest Flash model, confirmed free-tier ("Free of charge") on the official pricing page. Superseded `gemini-3.5-flash` a week before this was written. |
| Image | **Cloudflare Workers AI — FLUX.1 [schnell]** (`@cf/black-forest-labs/flux-1-schnell`) | Current (non-deprecated) catalog entry, cheapest image model on the platform (~4.8 Neurons per 512×512 tile) against the free 10,000-Neuron/day pool. |
| Audio | **Cloudflare Workers AI — MeloTTS** (`@cf/myshell-ai/melotts`) | Current catalog entry, open-source TTS model, cheap against the free Neuron pool. |
| Pinning | **Pinata** (v3 Files API) | Free plan (1GB storage, 500 files, 10GB bandwidth/mo, 10K requests/mo) confirmed to require **no credit card**. |

All three model IDs and the Pinata v3 endpoint were confirmed directly
against the current official docs, not assumed from prior knowledge — see
the inline comments in `lib/gemini.ts`, `lib/cloudflare.ts`, and
`lib/pinata.ts` for exact sourcing notes. All are overridable via env vars
(`GEMINI_MODEL`, `CLOUDFLARE_IMAGE_MODEL`, `CLOUDFLARE_AUDIO_MODEL`) in case
the catalog moves on before this is revisited.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in .env.local with real keys (see .env.example for where to get each)
```

## Test harness (Task 3)

Runs one sample job per modality end-to-end (generate → pin → verify the
gateway serves back byte-identical content):

```bash
npm run test:harness
```

## Local dev server

```bash
npm run dev
# POST http://localhost:3000/api/generate
# body: {"modality": "TEXT" | "IMAGE" | "AUDIO", "prompt": "..."}
```

## Non-negotiables honored

- Both API keys (Gemini, Cloudflare) and the Pinata JWT are read from
  `process.env` server-side only inside `lib/`; `api/generate.ts` never
  echoes them back, and error messages are caught and re-thrown without the
  raw upstream body to avoid accidentally leaking anything key-shaped.
- Nothing here touches `d:\providercourt\contract\` or `d:\providercourt\web\`.
