import { NextResponse } from "next/server";
import { completeSeatedById } from "@/lib/queue/service";
import { requireHostApiAuth } from "@/lib/queue/api-auth";

type Props = { params: Promise<{ entry: string }> };

export async function POST(_: Request, { params }: Props) {
  const auth = await requireHostApiAuth();
  if (!auth.ok) return auth.response;

  const { entry } = await params;
  const result = await completeSeatedById(entry, auth.profile.restaurant_id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return NextResponse.json({ ok: true, status: result.entry.status });
}
