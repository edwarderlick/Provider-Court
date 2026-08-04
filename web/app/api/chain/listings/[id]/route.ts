import { NextResponse } from "next/server";
import { readListing, statusForError } from "@/lib/genlayer-server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const listing = await readListing(Number(id));
    if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });
    return NextResponse.json({ listing });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
