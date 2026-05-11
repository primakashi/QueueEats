import { NextResponse } from "next/server";
import { cancelByToken } from "@/lib/queue/service";

type Props = { params: Promise<{ entry: string }> };

export async function POST(_: Request, { params }: Props) {
  const { entry } = await params;
  const result = await cancelByToken(entry);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return NextResponse.json({ ok: true, status: result.entry.status });
}
