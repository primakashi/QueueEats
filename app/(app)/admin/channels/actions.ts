"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type { OrderChannelConfig } from "@/lib/types";

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

export async function createChannel(formData: FormData): Promise<Result<OrderChannelConfig>> {
  const profile = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const name = String(formData.get("name") ?? "").trim();

  if (!id) return { ok: false, error: "ID saluran wajib diisi" };
  if (!/^[a-z0-9_]+$/.test(id)) return { ok: false, error: "ID hanya boleh huruf kecil, angka, dan underscore" };
  if (!name) return { ok: false, error: "Nama saluran wajib diisi" };

  const supabase = await createClient();
  const restaurant_id = getRestaurantFilter(profile);

  const { data: existing } = await supabase.from("order_channels").select("id").eq("id", id).maybeSingle();
  if (existing) return { ok: false, error: "ID saluran sudah digunakan" };

  let sortQ = supabase.from("order_channels").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  if (restaurant_id) sortQ = sortQ.eq("restaurant_id", restaurant_id);
  const { data: lastRow } = await sortQ.maybeSingle();
  const sort_order = ((lastRow?.sort_order as number) ?? -1) + 1;

  const { data, error } = await supabase
    .from("order_channels")
    .insert({ id, name, sort_order, restaurant_id })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true, data: data as OrderChannelConfig };
}

export async function updateChannel(formData: FormData): Promise<Result> {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!id) return { ok: false, error: "ID tidak ada" };
  if (!name) return { ok: false, error: "Nama saluran wajib diisi" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("order_channels")
    .update({ name })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}

export async function toggleChannelActive(id: string, is_active: boolean): Promise<Result> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("order_channels")
    .update({ is_active })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}

export async function deleteChannel(id: string): Promise<Result> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("order_channels").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}
