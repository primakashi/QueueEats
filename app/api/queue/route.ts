import { NextRequest, NextResponse } from "next/server";
import { createQueueEntry } from "@/lib/queue/service";

type CreateBody = {
  name?: string;
  party_size?: number;
  phone?: string | null;
  waiting_in_store?: boolean;
  party_has_infant?: boolean;
  party_has_elderly?: boolean;
  party_has_child?: boolean;
};

export async function POST(req: NextRequest) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid" }, { status: 400 });
  }

  if (!body.name || typeof body.party_size !== "number") {
    return NextResponse.json(
      { error: "Nama dan jumlah orang wajib diisi" },
      { status: 400 },
    );
  }

  try {
    const created = await createQueueEntry({
      name: body.name,
      party_size: body.party_size,
      phone: body.phone ?? null,
      waiting_in_store: body.waiting_in_store,
      party_has_infant: body.party_has_infant,
      party_has_elderly: body.party_has_elderly,
      party_has_child: body.party_has_child,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Gagal membuat entri antrian",
      },
      { status: 400 },
    );
  }
}
