import { NextResponse } from "next/server";
import { readAllOrders, statusForError } from "@/lib/genlayer-server";

export async function GET() {
  try {
    const orders = await readAllOrders();
    return NextResponse.json({ orders });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: statusForError(err) });
  }
}
