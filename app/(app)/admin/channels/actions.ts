"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type { OrderChannelConfig } from "@/lib/types";

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function uniqueChannelId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
): Promise<string> {
  const root = base || "channel";
  let candidate = root;
  for (let i = 2; i < 100; i++) {
    const { data } = await supabase
      .from("order_channels")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${root}_${i}`;
  }
  return `${root}_${Date.now()}`;
}

export async function createChannel(formData: FormData): Promise<Result<OrderChannelConfig>> {
  const profile = await requireRole(["admin", "owner"]);
  const name = String(formData.get("name") ?? "").trim();
  const rawKind = String(formData.get("kind") ?? "").trim();
  const kind = rawKind === "online" ? "online" : rawKind === "direct" ? "direct" : null;

  if (!name) return { ok: false, error: "Nama saluran wajib diisi" };

  const supabase = await createClient();
  const restaurant_id = getRestaurantFilter(profile);

  const id = await uniqueChannelId(supabase, slugify(name));

  let sortQ = supabase.from("order_channels").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  if (restaurant_id) sortQ = sortQ.eq("restaurant_id", restaurant_id);
  const { data: lastRow } = await sortQ.maybeSingle();
  const sort_order = ((lastRow?.sort_order as number) ?? -1) + 1;

  const { data, error } = await supabase
    .from("order_channels")
    .insert({ id, name, sort_order, restaurant_id, kind })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true, data: data as OrderChannelConfig };
}

export async function updateChannel(formData: FormData): Promise<Result> {
  await requireRole(["admin", "owner"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const rawKind = String(formData.get("kind") ?? "").trim();
  const kind = rawKind === "online" ? "online" : rawKind === "direct" ? "direct" : null;

  if (!id) return { ok: false, error: "ID tidak ada" };
  if (!name) return { ok: false, error: "Nama saluran wajib diisi" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("order_channels")
    .update({ name, kind })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}

export async function toggleChannelActive(id: string, is_active: boolean): Promise<Result> {
  await requireRole(["admin", "owner"]);
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
  await requireRole(["admin", "owner"]);
  const supabase = await createClient();
  const { error } = await supabase.from("order_channels").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}
