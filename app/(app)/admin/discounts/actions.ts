"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type { DiscountScope, DiscountValueType } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

function parseScope(v: unknown): DiscountScope | null {
  return v === "menu_item" || v === "transaction" || v === "daily" ? v : null;
}

function parseValueType(v: unknown): DiscountValueType | null {
  return v === "amount" || v === "percent" ? v : null;
}

export async function createDiscount(formData: FormData): Promise<Result> {
  const profile = await requireRole(["admin", "owner", "branch_manager"]);
  const name = String(formData.get("name") ?? "").trim();
  const scope = parseScope(formData.get("scope"));
  const valueType = parseValueType(formData.get("value_type"));
  const valueRaw = Number(formData.get("value") ?? 0);
  const value = Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0;
  const activeFrom = String(formData.get("active_from") ?? "").trim() || null;
  const activeUntil = String(formData.get("active_until") ?? "").trim() || null;
  const menuItemId = String(formData.get("menu_item_id") ?? "").trim() || null;
  const isActive = formData.get("is_active") === "on";

  if (!name) return { ok: false, error: "Nama wajib diisi" };
  if (!scope) return { ok: false, error: "Tipe diskon tidak valid" };
  if (!valueType) return { ok: false, error: "Tipe nilai tidak valid" };
  if (value <= 0) return { ok: false, error: "Nilai harus lebih dari 0" };
  if (valueType === "percent" && value > 100) {
    return { ok: false, error: "Persen tidak boleh > 100" };
  }
  if (scope === "menu_item" && !menuItemId) {
    return { ok: false, error: "Pilih item menu untuk diskon per item" };
  }

  const restaurant_id = getRestaurantFilter(profile);
  const supabase = await createClient();
  const { error } = await supabase.from("discounts").insert({
    name,
    scope,
    value_type: valueType,
    value,
    active_from: activeFrom,
    active_until: activeUntil,
    menu_item_id: scope === "menu_item" ? menuItemId : null,
    is_active: isActive,
    restaurant_id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/discounts");
  return { ok: true };
}

export async function updateDiscount(formData: FormData): Promise<Result> {
  const profile = await requireRole(["admin", "owner", "branch_manager"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const scope = parseScope(formData.get("scope"));
  const valueType = parseValueType(formData.get("value_type"));
  const valueRaw = Number(formData.get("value") ?? 0);
  const value = Number.isFinite(valueRaw) ? Math.max(0, valueRaw) : 0;
  const activeFrom = String(formData.get("active_from") ?? "").trim() || null;
  const activeUntil = String(formData.get("active_until") ?? "").trim() || null;
  const menuItemId = String(formData.get("menu_item_id") ?? "").trim() || null;
  const isActive = formData.get("is_active") === "on";

  if (!id) return { ok: false, error: "ID tidak ada" };
  if (!name) return { ok: false, error: "Nama wajib diisi" };
  if (!scope) return { ok: false, error: "Tipe diskon tidak valid" };
  if (!valueType) return { ok: false, error: "Tipe nilai tidak valid" };
  if (value <= 0) return { ok: false, error: "Nilai harus lebih dari 0" };
  if (valueType === "percent" && value > 100) {
    return { ok: false, error: "Persen tidak boleh > 100" };
  }
  if (scope === "menu_item" && !menuItemId) {
    return { ok: false, error: "Pilih item menu untuk diskon per item" };
  }

  const rid = getRestaurantFilter(profile);
  const supabase = await createClient();
  let q = supabase
    .from("discounts")
    .update({
      name,
      scope,
      value_type: valueType,
      value,
      active_from: activeFrom,
      active_until: activeUntil,
      menu_item_id: scope === "menu_item" ? menuItemId : null,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (rid) q = q.eq("restaurant_id", rid);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/discounts");
  return { ok: true };
}

export async function deleteDiscount(id: string): Promise<Result> {
  const profile = await requireRole(["admin", "owner", "branch_manager"]);
  const rid = getRestaurantFilter(profile);
  const supabase = await createClient();
  let q = supabase.from("discounts").delete().eq("id", id);
  if (rid) q = q.eq("restaurant_id", rid);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/discounts");
  return { ok: true };
}
