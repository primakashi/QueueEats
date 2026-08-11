import { NextResponse } from "next/server";
import { listHostFloorState } from "@/lib/queue/service";
import { requireHostApiAuth } from "@/lib/queue/api-auth";

export async function GET() {
  const auth = await requireHostApiAuth();
  if (!auth.ok) return auth.response;

  try {
    const result = await listHostFloorState(auth.profile.restaurant_id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat denah meja" },
      { status: 400 },
    );
  }
}
