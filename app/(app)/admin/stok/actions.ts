"use server";

import { refresh, revalidatePath as invalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, getOutletFilter, getRestaurantFilter } from "@/lib/auth";
import type {
  DailyStock,
  MenuCategory,
  MenuItem,
  MenuStockOverride,
  StockMovement,
} from "@/lib/types";

function revalidatePath(path: string): void {
  invalidatePath(path);
  refresh();
}

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function todayDate(): string {
  return new Date().toLocaleDateString("en-CA");
}

const STOK_ROLES = ["admin", "owner", "branch_manager", "cashier", "waiter"] as const;

export type StockSnapshot = {
  date: string;
  outlet_id: string;
  outlet_name: string | null;
  items: Array<{
    menu_item: MenuItem;
    category_name: string | null;
    daily_stock: DailyStock;
    effective_quota: number | null;
    low_threshold: number;
    yesterday_closing: number | null;
    yesterday_opening: number | null;
  }>;
  movements: Array<StockMovement & { menu_name: string | null; actor_name: string | null }>;
};

function yesterdayDate(today: string): string {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA");
}

export async function getStockSnapshot(
  outletIdOverride?: string,
): Promise<{ ok: true; data: StockSnapshot } | { ok: false; error: string }> {
  const profile = await requireRole([...STOK_ROLES]);
  const supabase = await createClient();
  const restaurant_id = getRestaurantFilter(profile);
  const outletFilter = getOutletFilter(profile);

  // Resolve the outlet to read stock for.
  let outletId = outletFilter ?? outletIdOverride ?? null;
  if (!outletId && restaurant_id) {
    const { data: first } = await supabase
      .from("outlets")
      .select("id")
      .eq("restaurant_id", restaurant_id)
      .eq("is_archived", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    outletId = (first?.id as string | undefined) ?? null;
  }
  if (!outletId) return { ok: false, error: "Outlet tidak ditemukan" };

  const { data: outletRow } = await supabase
    .from("outlets")
    .select("id, name, restaurant_id")
    .eq("id", outletId)
    .maybeSingle();
  const outlet = outletRow as { id: string; name: string; restaurant_id: string | null } | null;
  if (!outlet) return { ok: false, error: "Outlet tidak ditemukan" };

  // Cross-restaurant safety: if the caller is scoped to a restaurant, refuse
  // outlets that belong to a different one (e.g. a tampered ?outlet= param).
  if (restaurant_id && outlet.restaurant_id && outlet.restaurant_id !== restaurant_id) {
    return { ok: false, error: "Outlet di luar restoran Anda" };
  }

  const effectiveRestaurantId = restaurant_id ?? outlet.restaurant_id;

  let menuItemsQ = supabase
    .from("menu_items")
    .select("id, category_id, name, description, price, image_url, is_available, sort_order, default_daily_quota, low_stock_threshold, created_at, updated_at");
  if (effectiveRestaurantId) menuItemsQ = menuItemsQ.eq("restaurant_id", effectiveRestaurantId);

  let categoriesQ = supabase.from("menu_categories").select("id, name");
  if (effectiveRestaurantId) categoriesQ = categoriesQ.eq("restaurant_id", effectiveRestaurantId);

  const overridesQ = supabase
    .from("menu_stock_overrides")
    .select("*")
    .eq("outlet_id", outletId);

  const date = todayDate();
  const dailyStockQ = supabase
    .from("daily_stock")
    .select("*")
    .eq("outlet_id", outletId)
    .eq("stock_date", date);

  const [
    { data: menuItemsRaw },
    { data: categoriesRaw },
    { data: overridesRaw },
    { data: dailyStockRaw },
  ] = await Promise.all([
    menuItemsQ.order("sort_order", { ascending: true }),
    categoriesQ.order("sort_order", { ascending: true }),
    overridesQ,
    dailyStockQ,
  ]);

  const menuItems = (menuItemsRaw ?? []) as MenuItem[];
  const categories = (categoriesRaw ?? []) as Pick<MenuCategory, "id" | "name">[];
  const overrides = (overridesRaw ?? []) as MenuStockOverride[];
  let dailyStocks = (dailyStockRaw ?? []) as DailyStock[];

  // Lazy-create today's daily_stock rows for any menu item that doesn't have one.
  const existingByItem = new Map(dailyStocks.map((d) => [d.menu_item_id, d]));
  const toInsert: Array<Partial<DailyStock>> = [];
  for (const m of menuItems) {
    if (existingByItem.has(m.id)) continue;
    const override = overrides.find((o) => o.menu_item_id === m.id);
    const quota = override?.daily_quota ?? m.default_daily_quota;
    toInsert.push({
      outlet_id: outletId,
      menu_item_id: m.id,
      restaurant_id: effectiveRestaurantId,
      stock_date: date,
      daily_quota: quota ?? null,
      opening_stock: quota ?? 0,
      current_stock: quota ?? 0,
      is_active: true,
      created_by: profile.id,
    });
  }
  if (toInsert.length > 0) {
    // Use admin client so the seed succeeds regardless of which user opens the
    // page first; RLS still gates downstream reads/writes per restaurant.
    // `ignoreDuplicates` + re-fetch handles the race where two users open the
    // page at the same time: one user wins the inserts, the other's INSERT is
    // a no-op, then both end up with the same canonical row set.
    const admin = createAdminClient();
    await admin
      .from("daily_stock")
      .upsert(toInsert, { onConflict: "outlet_id,menu_item_id,stock_date", ignoreDuplicates: true });
    const { data: refreshed } = await admin
      .from("daily_stock")
      .select("*")
      .eq("outlet_id", outletId)
      .eq("stock_date", date);
    dailyStocks = (refreshed ?? []) as DailyStock[];
  }

  // Yesterday's closing as a reference for opening-stock UI.
  const yDate = yesterdayDate(date);
  const { data: yRows } = await supabase
    .from("daily_stock")
    .select("menu_item_id, opening_stock, current_stock")
    .eq("outlet_id", outletId)
    .eq("stock_date", yDate);
  const yesterdayByItem = new Map(
    ((yRows ?? []) as Array<{ menu_item_id: string; opening_stock: number; current_stock: number }>).map(
      (r) => [r.menu_item_id, r],
    ),
  );

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const stockByItem = new Map(dailyStocks.map((d) => [d.menu_item_id, d]));

  const items = menuItems
    .filter((m) => stockByItem.has(m.id))
    .map((m) => {
      const override = overrides.find((o) => o.menu_item_id === m.id);
      const effective_quota = override?.daily_quota ?? m.default_daily_quota;
      const low_threshold = override?.low_stock_threshold ?? m.low_stock_threshold;
      const yest = yesterdayByItem.get(m.id);
      return {
        menu_item: m,
        category_name: m.category_id ? categoryName.get(m.category_id) ?? null : null,
        daily_stock: stockByItem.get(m.id)!,
        effective_quota,
        low_threshold,
        yesterday_closing: yest?.current_stock ?? null,
        yesterday_opening: yest?.opening_stock ?? null,
      };
    });

  // Movements for today, with menu + actor names joined.
  const dailyIds = items.map((i) => i.daily_stock.id);
  let movements: Array<StockMovement & { menu_name: string | null; actor_name: string | null }> = [];
  if (dailyIds.length > 0) {
    // The stock page has already validated the tenant and outlet above. Read
    // movements with the server client so a stale/misaligned RLS policy cannot
    // hide rows that were written by adjust_daily_stock while the central log
    // still shows them.
    const movementDb = createAdminClient();
    const { data: movRaw } = await movementDb
      .from("stock_movements")
      .select(`
        *,
        menu:menu_items ( name ),
        actor:profiles!stock_movements_created_by_fkey ( full_name )
      `)
      .in("daily_stock_id", dailyIds)
      .order("created_at", { ascending: false })
      .limit(50);
    movements = ((movRaw ?? []) as Array<Record<string, unknown>>).map((m) => ({
      id: m.id as string,
      daily_stock_id: m.daily_stock_id as string,
      outlet_id: m.outlet_id as string | null,
      restaurant_id: m.restaurant_id as string | null,
      menu_item_id: m.menu_item_id as string | null,
      change: m.change as number,
      resulting_stock: m.resulting_stock as number,
      reason: m.reason as StockMovement["reason"],
      order_id: m.order_id as string | null,
      notes: m.notes as string | null,
      created_by: m.created_by as string | null,
      created_at: m.created_at as string,
      menu_name: (m.menu as { name?: string } | null)?.name ?? null,
      actor_name: (m.actor as { full_name?: string } | null)?.full_name ?? null,
    }));
  }

  return {
    ok: true,
    data: {
      date,
      outlet_id: outletId,
      outlet_name: outlet.name,
      items,
      movements,
    },
  };
}

export async function updateOpeningStock(
  dailyStockId: string,
  opening: number,
  quota: number | null,
): Promise<Result> {
  const profile = await requireRole([...STOK_ROLES]);
  const supabase = await createClient();
  const safeOpening = Math.max(0, Math.floor(opening));
  const safeQuota = quota == null ? null : Math.max(0, Math.floor(quota));

  const { data: row } = await supabase
    .from("daily_stock")
    .select("id, opening_stock, current_stock, confirmed_at")
    .eq("id", dailyStockId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Stok harian tidak ditemukan" };

  // Move current_stock by the same delta that opening_stock moves.
  const delta = safeOpening - (row.opening_stock as number);
  const newCurrent = Math.max(0, (row.current_stock as number) + delta);

  const { error } = await supabase
    .from("daily_stock")
    .update({
      opening_stock: safeOpening,
      current_stock: newCurrent,
      daily_quota: safeQuota,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dailyStockId);
  if (error) return { ok: false, error: error.message };

  // Log only when current changed.
  if (delta !== 0) {
    await supabase.from("stock_movements").insert({
      daily_stock_id: dailyStockId,
      change: delta,
      resulting_stock: newCurrent,
      reason: "adjust",
      created_by: profile.id,
      notes: "Edit stok awal",
    });
  }

  revalidatePath("/admin/stok");
  return { ok: true };
}

export async function addStock(
  dailyStockId: string,
  amount: number,
  reason: "add" | "remove" | "adjust" = "add",
  notes?: string,
): Promise<Result<{ new_current: number }>> {
  const profile = await requireRole([...STOK_ROLES]);
  const supabase = await createClient();
  const change = reason === "remove" ? -Math.abs(amount) : Math.abs(amount);

  const { data: newCurrent, error } = await supabase.rpc("adjust_daily_stock", {
    p_daily_stock_id: dailyStockId,
    p_change: change,
    p_reason: reason,
    p_order_id: null,
    p_notes: notes ?? null,
    p_actor: profile.id,
  });
  if (error) return { ok: false, error: error.message };
  if (newCurrent === -1) return { ok: false, error: "Item dinonaktifkan" };

  revalidatePath("/admin/stok");
  return { ok: true, data: { new_current: newCurrent as number } };
}

export async function toggleStockActive(
  dailyStockId: string,
  is_active: boolean,
): Promise<Result> {
  const profile = await requireRole([...STOK_ROLES]);
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("daily_stock")
    .select("id, current_stock")
    .eq("id", dailyStockId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Stok tidak ditemukan" };

  const { error } = await supabase
    .from("daily_stock")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", dailyStockId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("stock_movements").insert({
    daily_stock_id: dailyStockId,
    change: 0,
    resulting_stock: row.current_stock as number,
    reason: is_active ? "enable" : "disable",
    created_by: profile.id,
  });

  revalidatePath("/admin/stok");
  return { ok: true };
}

export async function confirmDailyStock(outletId: string): Promise<Result> {
  const profile = await requireRole([...STOK_ROLES]);
  const supabase = await createClient();
  const date = todayDate();
  const { error } = await supabase
    .from("daily_stock")
    .update({
      confirmed_at: new Date().toISOString(),
      confirmed_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("outlet_id", outletId)
    .eq("stock_date", date)
    .is("confirmed_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/stok");
  return { ok: true };
}

export async function setDefaultDailyQuota(
  menuItemId: string,
  quota: number | null,
): Promise<Result> {
  await requireRole(["admin", "owner", "branch_manager"]);
  const supabase = await createClient();
  const safe = quota == null ? null : Math.max(0, Math.floor(quota));
  const { error } = await supabase
    .from("menu_items")
    .update({ default_daily_quota: safe, updated_at: new Date().toISOString() })
    .eq("id", menuItemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/stok");
  revalidatePath("/admin/menu");
  return { ok: true };
}

// Set the per-outlet override of a menu item's default daily quota. Pass null
// to clear the override and fall back to the menu-item-level default.
export async function setOutletDailyQuota(
  outletId: string,
  menuItemId: string,
  quota: number | null,
): Promise<Result> {
  await requireRole(["admin", "owner", "branch_manager"]);
  const supabase = await createClient();
  const safe = quota == null ? null : Math.max(0, Math.floor(quota));

  const { data: existing } = await supabase
    .from("menu_stock_overrides")
    .select("id, low_stock_threshold")
    .eq("outlet_id", outletId)
    .eq("menu_item_id", menuItemId)
    .maybeSingle();

  if (safe == null && (!existing || existing.low_stock_threshold == null)) {
    if (existing) {
      const { error } = await supabase
        .from("menu_stock_overrides")
        .delete()
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    }
  } else if (existing) {
    const { error } = await supabase
      .from("menu_stock_overrides")
      .update({ daily_quota: safe, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("menu_stock_overrides").insert({
      outlet_id: outletId,
      menu_item_id: menuItemId,
      daily_quota: safe,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/stok");
  return { ok: true };
}
