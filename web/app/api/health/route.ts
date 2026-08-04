import { NextResponse } from "next/server";

// Zero-dependency GET endpoint so you can confirm generation's env vars are
// actually loaded, before wiring in real keys or debugging a failed
// purchase. Never echoes the values themselves, only presence. Merged in
// from the former provider-service project -- these are now web's own env
// vars, no second deployment to check separately.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "web",
    env: {
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      CLOUDFLARE_ACCOUNT_ID: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID),
      CLOUDFLARE_API_TOKEN: Boolean(process.env.CLOUDFLARE_API_TOKEN),
      PINATA_JWT: Boolean(process.env.PINATA_JWT),
    },
  });
}
