"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { createQRCode } from "@/lib/xendit";
import type { Payment } from "@/lib/types";

export async function startQrisPayment(
  orderId: string,
): Promise<
  | { ok: true; payment: Payment }
  | { ok: false; error: string }
> {
  await requireRole(["cashier", "admin"]);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id,order_number,total,payment_status,payment_method,status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Order not found" };
  if (order.payment_status === "paid") {
    return { ok: false, error: "Order already paid" };
  }

  // Reuse an active (pending) QRIS payment if it exists
  const { data: existing } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", orderId)
    .eq("provider", "xendit")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { ok: true, payment: existing as Payment };
  }

  let qr;
  try {
    qr = await createQRCode({
      referenceId: `${order.order_number}-${Date.now()}`,
      amount: order.total,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("payments")
    .insert({
      order_id: orderId,
      provider: "xendit",
      xendit_qr_id: qr.id,
      qr_string: qr.qr_string,
      amount: qr.amount,
      status: "pending",
      raw_payload: qr as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };

  await supabase
    .from("orders")
    .update({ payment_method: "qris", payment_status: "pending" })
    .eq("id", orderId);

  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");

  return { ok: true, payment: inserted as Payment };
}

export async function markCashPaid(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin"]);
  // Use admin client to bypass RLS for a one-shot multi-table write
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id,total,payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found" };
  if (order.payment_status === "paid")
    return { ok: false, error: "Order already paid" };

  const paidAt = new Date().toISOString();

  const { error: payErr } = await admin.from("payments").insert({
    order_id: orderId,
    provider: "cash",
    amount: order.total,
    status: "paid",
    paid_at: paidAt,
  });
  if (payErr) return { ok: false, error: payErr.message };

  const { error: ordErr } = await admin
    .from("orders")
    .update({
      payment_method: "cash",
      payment_status: "paid",
      status: "completed",
    })
    .eq("id", orderId);
  if (ordErr) return { ok: false, error: ordErr.message };

  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  return { ok: true };
}

export async function cancelQrisPayment(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ status: "expired" })
    .eq("order_id", orderId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  await supabase
    .from("orders")
    .update({ payment_status: "unpaid", payment_method: null })
    .eq("id", orderId);
  revalidatePath(`/cashier/${orderId}`);
  return { ok: true };
}
