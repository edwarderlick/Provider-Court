import { NextResponse } from "next/server";
import { readOrder, statusForError } from "@/lib/genlayer-server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const order = await readOrder(Number(id));
    if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
