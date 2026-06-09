"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { createPaymentQR } from "@/lib/payments";
import type { Payment } from "@/lib/types";

export async function startQrisPayment(
  orderId: string,
  paymentDestination?: string,
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

  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") {
    return { ok: false, error: "Pesanan sudah dibayar" };
  }

  // Reuse an active (pending) QRIS/mock payment if it exists
  const { data: existing } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", orderId)
    .in("provider", ["xendit", "mock"])
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { ok: true, payment: existing as Payment };
  }

  let qr;
  try {
    qr = await createPaymentQR({
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
      provider: qr.provider,
      xendit_qr_id: qr.id,
      qr_string: qr.qr_string,
      amount: qr.amount,
      status: "pending",
      raw_payload: qr.raw_payload,
    })
    .select()
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };

  await supabase
    .from("orders")
    .update({
      payment_method: "qris",
      payment_status: "pending",
      ...(paymentDestination ? { payment_destination: paymentDestination } : {}),
    })
    .eq("id", orderId);

  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");

  return { ok: true, payment: inserted as Payment };
}

export async function startCashPayment(
  orderId: string,
  paymentDestination?: string,
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

  if (!order) return { ok: false, error: "Pesanan tidak ditemukan" };
  if (order.payment_status === "paid") {
    return { ok: false, error: "Pesanan sudah dibayar" };
  }

  const { data: existing } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", orderId)
    .eq("provider", "cash")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { ok: true, payment: existing as Payment };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("payments")
    .insert({
      order_id: orderId,
      provider: "cash",
      amount: order.total,
      status: "pending",
      raw_payload: { mock_flow: true, reference_id: `${order.order_number}-cash` },
    })
    .select()
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };

  await supabase
    .from("orders")
    .update({
      payment_method: "cash",
      payment_status: "pending",
      ...(paymentDestination ? { payment_destination: paymentDestination } : {}),
    })
    .eq("id", orderId);

  revalidatePath(`/cashier/${orderId}`);
  revalidatePath("/cashier");

  return { ok: true, payment: inserted as Payment };
}

export async function simulateCashPayment(
  paymentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin"]);
  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("payments")
    .select("id,order_id,provider,status")
    .eq("id", paymentId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) return { ok: false, error: "Pembayaran tidak ditemukan" };
  if (row.provider !== "cash") {
    return { ok: false, error: "Bukan pembayaran tunai" };
  }
  if (row.status === "paid") return { ok: true };
  if (row.status !== "pending") {
    return { ok: false, error: "Pembayaran tunai tidak dalam status menunggu" };
  }

  const paidAt = new Date().toISOString();
  const { error: payErr } = await supabase
    .from("payments")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", paymentId)
    .eq("status", "pending");
  if (payErr) return { ok: false, error: payErr.message };

  const { error: ordErr } = await supabase
    .from("orders")
    .update({
      payment_method: "cash",
      payment_status: "paid",
      status: "completed",
    })
    .eq("id", row.order_id);
  if (ordErr) return { ok: false, error: ordErr.message };

  revalidatePath(`/cashier/${row.order_id}`);
  revalidatePath("/cashier");
  return { ok: true };
}

export async function simulateMockPayment(
  paymentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["cashier", "admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_mock_payment", {
    pid: paymentId,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  if (!res.ok) {
    return { ok: false, error: res.error ?? "Gagal menyelesaikan pembayaran mock" };
  }
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
