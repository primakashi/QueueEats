"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  let query = supabase
    .from("cashier_sessions")
    .select("*")
    .eq("session_date", todayDate())
    .eq("status", "open");
  if (outletId) {
    query = query.eq("outlet_id", outletId);
  } else if (restaurantId) {
    query = query.eq("restaurant_id", restaurantId).is("outlet_id", null);
  }

  const { data } = await query.maybeSingle();
  return (data as CashierSession | null);
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

  // Prevent duplicate open session — must be scoped by outlet (cabang),
  // or by restaurant when the restaurant has no outlets.
  const existing = await getOpenSession(outletId, restaurantId);
  if (existing) return { ok: false, error: "Sudah ada sesi yang terbuka hari ini" };

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

  const supabase = await createClient();

  // Verify session belongs to this user's outlet and is open
  const sessionQuery = supabase
    .from("cashier_sessions")
    .select("id, status, outlet_id")
    .eq("id", sessionId)
    .eq("status", "open");
  const { data: session } = await sessionQuery.maybeSingle();
  if (!session) return { ok: false, error: "Sesi tidak ditemukan atau sudah ditutup" };
  if (outletFilter && session.outlet_id !== outletFilter) {
    return { ok: false, error: "Tidak diizinkan" };
  }

  const restaurantId = getRestaurantFilter(profile);

  const { error } = await supabase.from("cash_movements").insert({
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

  const actualClosingCash = Number(formData.get("actual_closing_cash") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("cashier_sessions")
    .select("id, status, outlet_id")
    .eq("id", sessionId)
    .eq("status", "open")
    .maybeSingle();

  if (!session) return { ok: false, error: "Sesi tidak ditemukan atau sudah ditutup" };
  if (outletFilter && session.outlet_id !== outletFilter) {
    return { ok: false, error: "Tidak diizinkan" };
  }

  const { error } = await supabase
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
  const supabase = await createClient();

  const [{ data: movements }, { data: session }] = await Promise.all([
    supabase
      .from("cash_movements")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("cashier_sessions")
      .select("outlet_id, session_date")
      .eq("id", sessionId)
      .single(),
  ]);

  let cashSales = 0;
  if (session) {
    const dayStart = `${session.session_date}T00:00:00.000Z`;
    const dayEnd = `${session.session_date}T23:59:59.999Z`;
    let ordersQuery = supabase
      .from("orders")
      .select("total")
      .eq("payment_method", "cash")
      .eq("payment_status", "paid")
      .gte("updated_at", dayStart)
      .lte("updated_at", dayEnd);
    if (session.outlet_id) ordersQuery = ordersQuery.eq("outlet_id", session.outlet_id);
    const { data: cashOrders } = await ordersQuery;
    cashSales = (cashOrders ?? []).reduce((sum, o) => sum + (o.total as number), 0);
  }

  return {
    movements: (movements ?? []) as CashMovement[],
    cashSales,
  };
}
