import { NextResponse } from "next/server";
import { getQueueEntryByToken } from "@/lib/queue/service";

type Props = { params: Promise<{ entry: string }> };

export async function GET(_: Request, { params }: Props) {
  const { entry } = await params;
  try {
    const queueEntry = await getQueueEntryByToken(entry);
    if (!queueEntry) {
      return NextResponse.json({ error: "Entri antrean tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(queueEntry);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat entri antrean" },
      { status: 400 },
    );
  }
}
