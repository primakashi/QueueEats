import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Xendit QR payment webhook
// Docs: https://developers.xendit.co/api-reference/#payment-callback
// Event: "qr.payment" with status "SUCCEEDED".

type XenditQrPaymentEvent = {
  event: string;
  business_id?: string;
  created?: string;
  data?: {
    id?: string;
    qr_id?: string;
    qr_code_id?: string;
    amount?: number;
    status?: string;
    payment_id?: string;
    reference_id?: string;
    created?: string;
  };
  // Legacy shape some Xendit callbacks use (flat object)
  id?: string;
  qr_id?: string;
  qr_code_id?: string;
  amount?: number;
  status?: string;
  reference_id?: string;
};

export async function POST(req: NextRequest) {
  const expected = process.env.XENDIT_CALLBACK_TOKEN;
  const got = req.headers.get("x-callback-token");
  if (!expected) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }
  if (got !== expected) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: XenditQrPaymentEvent;
  try {
    body = (await req.json()) as XenditQrPaymentEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event ?? "";
  const d = body.data ?? body;
  const qrId = d.qr_code_id ?? d.qr_id ?? d.id;
  const status = (d.status ?? "").toUpperCase();

  if (!qrId) {
    return NextResponse.json({ error: "Missing qr id" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id, status")
    .eq("xendit_qr_id", qrId)
    .maybeSingle();

  if (!payment) {
    // Unknown QR; ignore but acknowledge.
    return NextResponse.json({ received: true, matched: false });
  }

  const isSuccess =
    status === "SUCCEEDED" ||
    status === "PAID" ||
    event === "qr.payment" && status === "SUCCEEDED";

  if (isSuccess) {
    if (payment.status !== "paid") {
      const paidAt = new Date().toISOString();
      await admin
        .from("payments")
        .update({
          status: "paid",
          paid_at: paidAt,
          raw_payload: body as unknown as Record<string, unknown>,
        })
        .eq("id", payment.id);

      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          payment_method: "qris",
        })
        .eq("id", payment.order_id);
    }
    return NextResponse.json({ received: true, applied: true });
  }

  if (status === "FAILED" || status === "EXPIRED") {
    await admin
      .from("payments")
      .update({
        status: status === "EXPIRED" ? "expired" : "failed",
        raw_payload: body as unknown as Record<string, unknown>,
      })
      .eq("id", payment.id);
    await admin
      .from("orders")
      .update({ payment_status: "unpaid", payment_method: null })
      .eq("id", payment.order_id);
  }

  return NextResponse.json({ received: true });
}
