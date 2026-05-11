import { NextResponse } from "next/server";
import { markWhatsAppDelivered } from "@/lib/queue/service";
import { requireHostApiAuth } from "@/lib/queue/api-auth";

type Props = { params: Promise<{ entry: string }> };

export async function POST(_: Request, { params }: Props) {
  const unauthorized = await requireHostApiAuth();
  if (unauthorized) return unauthorized;

  const { entry } = await params;
  const result = await markWhatsAppDelivered(entry);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return NextResponse.json({ ok: true });
}
