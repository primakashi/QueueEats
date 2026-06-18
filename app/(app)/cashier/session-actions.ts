"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import type { CashierSession, CashMovement, CashMovementCategory, CashMovementType } from "@/lib/types";

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function todayDate(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export async function getOpenSession(
  outletId: string | null,
  restaurantId?: string | null,
): Promise<CashierSession | null> {
  if (!outletId && !restaurantId) return null;
  // Admin (service-role) client: the user-scoped client is filtered by RLS,
  // which prevents account A from seeing a session opened by account B even
  // when they're in the same restaurant. The page already authenticated the
  // caller and we constrain the query to their outlet/restaurant scope, so
  // bypassing RLS here only enables the sharing the product spec requires.
  const admin = createAdminClient();

  const baseQuery = () =>
    admin
      .from("cashier_sessions")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1);

  if (restaurantId) {
    const { data, error } = await baseQuery().eq("restaurant_id", restaurantId);
    if (error) console.error("getOpenSession restaurant query failed", error);
    if (data?.[0]) return data[0] as CashierSession;
  }

  if (outletId) {
    const { data, error } = await baseQuery().eq("outlet_id", outletId);
    if (error) console.error("getOpenSession outlet query failed", error);
    if (data?.[0]) return data[0] as CashierSession;
  }

  return null;
}

export async function openSession(formData: FormData): Promise<Result<CashierSession>> {
  const profile = await requireRole(["cashier", "admin", "branch_manager", "owner"]);
  const rawOutlet = String(formData.get("outlet_id") ?? "").trim();
  const outletId = getOutletFilter(profile) ?? (rawOutlet || null);
  const openingCash = Math.max(0, Number(formData.get("opening_cash") ?? 0));
  const restaurantId = getRestaurantFilter(profile);

  if (!outletId && !restaurantId) {
    return { ok: false, error: "Outlet atau restoran tidak ditemukan" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cashier_sessions")
    .insert({
      outlet_id: outletId,
      restaurant_id: restaurantId,
      opened_by: profile.id,
      session_date: todayDate(),
      opening_cash: openingCash,
      status: "open",
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cashier");
  return { ok: true, data: data as CashierSession };
}

export async function addCashMovement(
  sessionId: string,
  formData: FormData,
): Promise<Result> {
  const profile = await requireRole(["cashier", "admin", "branch_manager", "owner"]);
  const outletFilter = getOutletFilter(profile);

  const type = String(formData.get("type") ?? "") as CashMovementType;
  const category = String(formData.get("category") ?? "other") as CashMovementCategory;
  const amount = Number(formData.get("amount") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!["cash_in", "cash_out"].includes(type)) return { ok: false, error: "Tipe tidak valid" };
  if (!amount || amount <= 0) return { ok: false, error: "Jumlah harus lebih dari 0" };

  // See getOpenSession for why the admin client is used.
  const admin = createAdminClient();
  const restaurantId = getRestaurantFilter(profile);

  const { data: session } = await admin
    .from("cashier_sessions")
    .select("id, status, outlet_id, restaurant_id")
    .eq("id", sessionId)
    .eq("status", "open")
    .maybeSingle();
  if (!session) return { ok: false, error: "Sesi tidak ditemukan atau sudah ditutup" };
  if (restaurantId && session.restaurant_id !== restaurantId) {
    return { ok: false, error: "Tidak diizinkan" };
  }
  if (!restaurantId && outletFilter && session.outlet_id !== outletFilter) {
    return { ok: false, error: "Tidak diizinkan" };
  }

  const { error } = await admin.from("cash_movements").insert({
    session_id: sessionId,
    outlet_id: session.outlet_id,
    restaurant_id: restaurantId,
    type,
    category,
    amount,
    notes,
    created_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/cashier");
  return { ok: true };
}

export async function closeSession(
  sessionId: string,
  formData: FormData,
): Promise<Result> {
  const profile = await requireRole(["cashier", "admin", "branch_manager", "owner"]);
  const outletFilter = getOutletFilter(profile);
  const restaurantId = getRestaurantFilter(profile);

  const actualClosingCash = Number(formData.get("actual_closing_cash") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // See getOpenSession for why the admin client is used.
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("cashier_sessions")
    .select("id, status, outlet_id, restaurant_id")
    .eq("id", sessionId)
    .eq("status", "open")
    .maybeSingle();

  if (!session) return { ok: false, error: "Sesi tidak ditemukan atau sudah ditutup" };
  if (restaurantId && session.restaurant_id !== restaurantId) {
    return { ok: false, error: "Tidak diizinkan" };
  }
  if (!restaurantId && outletFilter && session.outlet_id !== outletFilter) {
    return { ok: false, error: "Tidak diizinkan" };
  }

  const { error } = await admin
    .from("cashier_sessions")
    .update({
      status: "closed",
      closed_by: profile.id,
      closed_at: new Date().toISOString(),
      actual_closing_cash: actualClosingCash,
      notes,
    })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cashier");
  return { ok: true };
}

export async function getSessionSummary(sessionId: string): Promise<{
  movements: CashMovement[];
  cashSales: number;
}> {
  // See getOpenSession: shared sessions require service-role reads so all
  // kasir users see the same totals regardless of who opened the session.
  const admin = createAdminClient();

  const [{ data: movements }, { data: session }] = await Promise.all([
    admin
      .from("cash_movements")
      .select("id, session_id, type, amount, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    admin
      .from("cashier_sessions")
      .select("outlet_id, opened_at")
      .eq("id", sessionId)
      .single(),
  ]);

  let cashSales = 0;
  if (session) {
    let ordersQuery = admin
      .from("orders")
      .select("total")
      .eq("payment_method", "cash")
      .eq("payment_status", "paid")
      .gte("updated_at", session.opened_at);
    if (session.outlet_id) ordersQuery = ordersQuery.eq("outlet_id", session.outlet_id);
    const { data: cashOrders } = await ordersQuery;
    cashSales = (cashOrders ?? []).reduce((sum, o) => sum + (o.total as number), 0);
  }

  return {
    movements: (movements ?? []) as CashMovement[],
    cashSales,
  };
}
