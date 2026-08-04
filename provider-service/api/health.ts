import type { VercelRequest, VercelResponse } from "@vercel/node";

// Zero-dependency GET endpoint so you can confirm the dev server is up and
// see (without spending any quota) which env vars are actually loaded, before
// wiring in real keys. Never echoes the values themselves, only presence.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    service: "provider-service",
    env: {
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      CLOUDFLARE_ACCOUNT_ID: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID),
      CLOUDFLARE_API_TOKEN: Boolean(process.env.CLOUDFLARE_API_TOKEN),
      PINATA_JWT: Boolean(process.env.PINATA_JWT),
    },
  });
}
