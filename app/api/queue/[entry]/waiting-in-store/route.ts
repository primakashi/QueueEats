import { NextRequest, NextResponse } from "next/server";
import {
  setWaitingInStoreById,
  setWaitingInStoreByToken,
} from "@/lib/queue/service";
import { requireHostApiAuth } from "@/lib/queue/api-auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ entry: string }> };

export async function POST(req: NextRequest, { params }: Props) {
  const { entry } = await params;
  let body: { waiting_in_store?: unknown };
  try {
    body = (await req.json()) as { waiting_in_store?: unknown };
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid" }, { status: 400 });
  }
  if (typeof body.waiting_in_store !== "boolean") {
    return NextResponse.json(
      { error: "Field waiting_in_store wajib berupa true atau false" },
      { status: 400 },
    );
  }

  const isUuid = UUID_RE.test(entry);
  if (isUuid) {
    const unauthorized = await requireHostApiAuth();
    if (unauthorized) return unauthorized;
    const result = await setWaitingInStoreById(entry, body.waiting_in_store);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.code });
    }
    return NextResponse.json({
      ok: true,
      waiting_in_store: result.entry.waiting_in_store,
    });
  }

  const result = await setWaitingInStoreByToken(entry, body.waiting_in_store);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return NextResponse.json({
    ok: true,
    waiting_in_store: result.entry.waiting_in_store,
  });
}
