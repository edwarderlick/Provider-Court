import { NextResponse } from "next/server";
import { readProvider, statusForError } from "@/lib/genlayer-server";

export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  try {
    const provider = await readProvider(address);
    if (!provider) return NextResponse.json({ error: "provider not registered" }, { status: 404 });
    return NextResponse.json({ provider });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
