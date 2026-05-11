import { NextResponse } from "next/server";
import { listQueueEntries } from "@/lib/queue/service";

export async function GET() {
  try {
    const result = await listQueueEntries();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat daftar antrian" },
      { status: 400 },
    );
  }
}
