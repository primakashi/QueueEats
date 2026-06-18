"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { Payment } from "@/lib/types";

export async function confirmPayment(
  orderId: string,
  method: "cash" | "edc",
  paymentDestination?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin"]);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id,order_number,total,payment_status,status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") return { ok: false, error: "Pesanan sudah dibayar" };

  const paidAt = new Date().toISOString();
  const { error: payErr } = await supabase.from("payments").insert({
    order_id: orderId,
    provider: method,
    amount: order.total,
    status: "paid",
    paid_at: paidAt,
    raw_payload: { method, reference_id: `${order.order_number}-${method}` },
  });
  if (payErr) return { ok: false, error: payErr.message };

  const { error: ordErr } = await supabase
    .from("orders")
    .update({
      payment_method: method,
      payment_status: "paid",
      ...(paymentDestination ? { payment_destination: paymentDestination } : {}),
    })
    .eq("id", orderId);
  if (ordErr) return { ok: false, error: ordErr.message };

  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");
  revalidatePath("/waiter");
  return { ok: true };
}

export async function cancelPaymentRecord(
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

export async function startQrisPayment(
  orderId: string,
  paymentDestination?: string,
): Promise<
  | { ok: true; payment: Payment }
  | { ok: false; error: string }
> {
  void orderId; void paymentDestination;
  return { ok: false, error: "QRIS tidak tersedia. Gunakan Tunai atau EDC." };
}
