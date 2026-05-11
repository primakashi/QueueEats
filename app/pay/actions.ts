"use server";

import { createClient } from "@/lib/supabase/server";

// Public endpoint used by the customer's /pay/<id> page.
// Safe because it only operates on payments whose provider = 'mock',
// enforced by the underlying SQL function.
export async function completeMockPaymentPublic(
  paymentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_mock_payment", {
    pid: paymentId,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  if (!res.ok) {
    return { ok: false, error: res.error ?? "Gagal menyelesaikan pembayaran" };
  }
  return { ok: true };
}
