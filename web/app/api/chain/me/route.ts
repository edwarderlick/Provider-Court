import { NextResponse } from "next/server";
import { buyerAddress, providerAddress } from "@/lib/genlayer-server";

// Exposes which demo accounts the server signs writes as, so the UI can
// display "connected as" without ever handling a private key client-side.
// Real wallet connect remains out of scope for this build.
export async function GET() {
  return NextResponse.json({ buyer: buyerAddress(), provider: providerAddress() });
}
