import { NextRequest, NextResponse } from "next/server";
import { seatById } from "@/lib/queue/service";
import { requireHostApiAuth } from "@/lib/queue/api-auth";

type SeatBody = { table_number?: string };
type Props = { params: Promise<{ entry: string }> };

export async function POST(req: NextRequest, { params }: Props) {
  const auth = await requireHostApiAuth();
  if (!auth.ok) return auth.response;

  let body: SeatBody;
  try {
    body = (await req.json()) as SeatBody;
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid" }, { status: 400 });
  }

  const { entry } = await params;
  const result = await seatById(
    entry,
    body.table_number ?? "",
    auth.profile.restaurant_id,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return NextResponse.json({ ok: true, status: result.entry.status });
}
