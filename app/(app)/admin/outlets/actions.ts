"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Outlet } from "@/lib/types";

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

export async function createOutlet(formData: FormData): Promise<Result<Outlet>> {
  const profile = await requireRole(["admin", "owner"]);
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const is_temporary = formData.get("is_temporary") === "true";
  const active_from = String(formData.get("active_from") ?? "").trim() || null;
  const active_until = String(formData.get("active_until") ?? "").trim() || null;
  const tax_rate = parseRate(String(formData.get("tax_rate") ?? "0"));
  const service_charge_rate = parseRate(String(formData.get("service_charge_rate") ?? "0"));
  const restaurant_id = getRestaurantFilter(profile);

  if (!name) return { ok: false, error: "Nama outlet wajib diisi" };
  if (is_temporary && !active_from) {
    return { ok: false, error: "Outlet sementara harus memiliki tanggal mulai" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outlets")
    .insert({ name, location, is_temporary, active_from, active_until, tax_rate, service_charge_rate, restaurant_id })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  await logAudit(profile, {
    table: "outlets",
    recordId: (data as Outlet).id,
    entityName: name,
    action: "create",
    changes: [
      { field: "tax_rate", oldValue: null, newValue: String(tax_rate) },
      { field: "service_charge_rate", oldValue: null, newValue: String(service_charge_rate) },
    ],
  });
  revalidatePath("/admin/outlets");
  revalidatePath("/waiter/new");
  return { ok: true, data: data as Outlet };
}

export async function updateOutlet(formData: FormData): Promise<Result> {
  const profile = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const is_temporary = formData.get("is_temporary") === "true";
  const active_from = String(formData.get("active_from") ?? "").trim() || null;
  const active_until = String(formData.get("active_until") ?? "").trim() || null;
  const tax_rate = parseRate(String(formData.get("tax_rate") ?? "0"));
  const service_charge_rate = parseRate(String(formData.get("service_charge_rate") ?? "0"));

  if (!id) return { ok: false, error: "ID tidak ada" };
  if (!name) return { ok: false, error: "Nama outlet wajib diisi" };
  if (is_temporary && !active_from) {
    return { ok: false, error: "Outlet sementara harus memiliki tanggal mulai" };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("outlets")
    .select("name, tax_rate, service_charge_rate")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("outlets")
    .update({ name, location, is_temporary, active_from, active_until, tax_rate, service_charge_rate })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  if (existing) {
    const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    if (existing.name !== name)
      changes.push({ field: "name", oldValue: existing.name, newValue: name });
    if (existing.tax_rate !== tax_rate)
      changes.push({ field: "tax_rate", oldValue: String(existing.tax_rate), newValue: String(tax_rate) });
    if (existing.service_charge_rate !== service_charge_rate)
      changes.push({ field: "service_charge_rate", oldValue: String(existing.service_charge_rate), newValue: String(service_charge_rate) });
    if (changes.length > 0) {
      await logAudit(profile, {
        table: "outlets",
        recordId: id,
        entityName: name,
        action: "update",
        changes,
      });
    }
  }

  revalidatePath("/admin/outlets");
  revalidatePath("/waiter/new");
  return { ok: true };
}

function parseRate(s: string): number {
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 0;
  return n / 100;
}

export async function archiveOutlet(id: string): Promise<Result> {
  await requireRole(["owner"]);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("outlets")
    .update({ is_archived: true })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/outlets");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function restoreOutlet(id: string): Promise<Result> {
  await requireRole(["owner"]);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("outlets")
    .update({ is_archived: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/outlets");
  revalidatePath("/waiter/new");
  return { ok: true };
}
