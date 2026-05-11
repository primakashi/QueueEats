import { NextResponse } from "next/server";
import { listHostFloorState } from "@/lib/queue/service";
import { requireHostApiAuth } from "@/lib/queue/api-auth";

export async function GET() {
  const unauthorized = await requireHostApiAuth();
  if (unauthorized) return unauthorized;

  try {
    const result = await listHostFloorState();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat denah meja" },
      { status: 400 },
    );
  }
}
