"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { DiscountScope, DiscountValueType } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

type DiscountRow = {
  id: string;
  name: string;
  scope: DiscountScope;
  value_type: DiscountValueType;
  value: number;
  active_from: string | null;
  active_until: string | null;
  menu_item_id: string | null;
  is_active: boolean;
};

function diffDiscount(
  before: DiscountRow,
  after: Pick<DiscountRow, "name" | "scope" | "value_type" | "value" | "active_from" | "active_until" | "menu_item_id" | "is_active">,
): Array<{ field: string; oldValue: string | null; newValue: string | null }> {
  const out: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];
  if (before.name !== after.name) out.push({ field: "name", oldValue: before.name, newValue: after.name });
  if (before.scope !== after.scope) out.push({ field: "scope", oldValue: before.scope, newValue: after.scope });
  if (before.value_type !== after.value_type)
    out.push({ field: "value_type", oldValue: before.value_type, newValue: after.value_type });
  if (Number(before.value) !== Number(after.value))
    out.push({ field: "value", oldValue: String(before.value), newValue: String(after.value) });
  if ((before.active_from ?? null) !== (after.active_from ?? null))
    out.push({ field: "active_from", oldValue: before.active_from, newValue: after.active_from });
  if ((before.active_until ?? null) !== (after.active_until ?? null))
    out.push({ field: "active_until", oldValue: before.active_until, newValue: after.active_until });
  if ((before.menu_item_id ?? null) !== (after.menu_item_id ?? null))
    out.push({ field: "menu_item_id", oldValue: before.menu_item_id, newValue: after.menu_item_id });
  if (before.is_active !== after.is_active)
    out.push({ field: "is_active", oldValue: String(before.is_active), newValue: String(after.is_active) });
  return out;
}

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
  const { data: inserted, error } = await supabase
    .from("discounts")
    .insert({
      name,
      scope,
      value_type: valueType,
      value,
      active_from: activeFrom,
      active_until: activeUntil,
      menu_item_id: scope === "menu_item" ? menuItemId : null,
      is_active: isActive,
      restaurant_id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  try {
    await logAudit(profile, {
      table: "discounts",
      recordId: inserted.id as string,
      entityName: name,
      action: "create",
      changes: [
        { field: "value", oldValue: null, newValue: `${value} ${valueType}` },
        { field: "scope", oldValue: null, newValue: scope },
      ],
    });
  } catch { /* audit logging is best-effort */ }

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

  let existingQ = supabase
    .from("discounts")
    .select("id, name, scope, value_type, value, active_from, active_until, menu_item_id, is_active")
    .eq("id", id);
  if (rid) existingQ = existingQ.eq("restaurant_id", rid);
  const { data: existing } = await existingQ.maybeSingle();

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

  if (existing) {
    const changes = diffDiscount(existing as DiscountRow, {
      name,
      scope,
      value_type: valueType,
      value,
      active_from: activeFrom,
      active_until: activeUntil,
      menu_item_id: scope === "menu_item" ? menuItemId : null,
      is_active: isActive,
    });
    if (changes.length > 0) {
      try {
        await logAudit(profile, {
          table: "discounts",
          recordId: id,
          entityName: name,
          action: "update",
          changes,
        });
      } catch { /* audit logging is best-effort */ }
    }
  }

  revalidatePath("/admin/discounts");
  return { ok: true };
}

export async function deleteDiscount(id: string): Promise<Result> {
  const profile = await requireRole(["admin", "owner", "branch_manager"]);
  const rid = getRestaurantFilter(profile);
  const supabase = await createClient();

  let existingQ = supabase
    .from("discounts")
    .select("id, name, scope, value_type, value, active_from, active_until, menu_item_id, is_active")
    .eq("id", id);
  if (rid) existingQ = existingQ.eq("restaurant_id", rid);
  const { data: existing } = await existingQ.maybeSingle();

  let q = supabase.from("discounts").delete().eq("id", id);
  if (rid) q = q.eq("restaurant_id", rid);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };

  if (existing) {
    try {
      await logAudit(profile, {
        table: "discounts",
        recordId: id,
        entityName: (existing as DiscountRow).name,
        action: "delete",
        changes: [
          {
            field: "value",
            oldValue: `${(existing as DiscountRow).value} ${(existing as DiscountRow).value_type}`,
            newValue: null,
          },
        ],
      });
    } catch { /* audit logging is best-effort */ }
  }

  revalidatePath("/admin/discounts");
  return { ok: true };
}
