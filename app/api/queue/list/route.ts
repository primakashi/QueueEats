import { NextResponse } from "next/server";
import { listQueueEntries } from "@/lib/queue/service";
import { getVerifiedProfile } from "@/lib/auth";

export async function GET() {
  try {
    const profile = await getVerifiedProfile();
    const result = await listQueueEntries(profile?.restaurant_id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat daftar antrian" },
      { status: 400 },
    );
  }
}
