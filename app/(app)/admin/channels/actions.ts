"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type {
  OrderChannelConfig,
  PaymentMethodConfig,
  PaymentMethodKind,
  PaymentProviderConfig,
} from "@/lib/types";

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

// =============================================================================
// Order channels
// =============================================================================

function parseCommission(raw: FormDataEntryValue | null): number {
  if (raw == null || raw === "") return 0;
  const pct = Number(raw);
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return Math.min(1, pct / 100);
}

export async function createChannel(formData: FormData): Promise<Result<OrderChannelConfig>> {
  const profile = await requireRole(["admin", "owner"]);
  const name = String(formData.get("name") ?? "").trim();
  const rawKind = String(formData.get("kind") ?? "").trim();
  const kind =
    rawKind === "online" ? "online"
    : rawKind === "direct" ? "direct"
    : rawKind === "popup" ? "popup"
    : null;
  const commission_rate = parseCommission(formData.get("commission_rate"));
  const requires_acceptance = formData.get("requires_acceptance") === "on" || formData.get("requires_acceptance") === "true";

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
    .insert({ id, name, sort_order, restaurant_id, kind, commission_rate, requires_acceptance })
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
  const kind =
    rawKind === "online" ? "online"
    : rawKind === "direct" ? "direct"
    : rawKind === "popup" ? "popup"
    : null;
  const commission_rate = parseCommission(formData.get("commission_rate"));
  const requires_acceptance = formData.get("requires_acceptance") === "on" || formData.get("requires_acceptance") === "true";

  if (!id) return { ok: false, error: "ID tidak ada" };
  if (!name) return { ok: false, error: "Nama saluran wajib diisi" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("order_channels")
    .update({ name, kind, commission_rate, requires_acceptance })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}

// Restaurant-level order workflow mode (F10).
export async function updateOrderWorkflow(mode: "standard" | "no_kitchen"): Promise<Result> {
  const profile = await requireRole(["admin", "owner"]);
  const restaurant_id = getRestaurantFilter(profile);
  if (!restaurant_id) return { ok: false, error: "Tidak terhubung ke restoran" };
  if (mode !== "standard" && mode !== "no_kitchen") {
    return { ok: false, error: "Mode tidak dikenal" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurants")
    .update({ order_workflow: mode })
    .eq("id", restaurant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
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

// =============================================================================
// Payment methods
// =============================================================================

async function uniqueMethodSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string | null,
  base: string,
): Promise<string> {
  const root = base || "method";
  let candidate = root;
  for (let i = 2; i < 100; i++) {
    let q = supabase.from("payment_methods").select("slug").eq("slug", candidate);
    if (restaurantId) q = q.eq("restaurant_id", restaurantId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    candidate = `${root}_${i}`;
  }
  return `${root}_${Date.now()}`;
}

export async function createPaymentMethod(formData: FormData): Promise<Result<PaymentMethodConfig>> {
  const profile = await requireRole(["admin", "owner"]);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const rawKind = String(formData.get("kind") ?? "simple");
  const kind: PaymentMethodKind = rawKind === "provider" ? "provider" : "simple";
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!name) return { ok: false, error: "Nama metode wajib diisi" };

  const supabase = await createClient();
  const restaurant_id = getRestaurantFilter(profile);
  const slug = await uniqueMethodSlug(supabase, restaurant_id, slugify(name));

  let sortQ = supabase.from("payment_methods").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  if (restaurant_id) sortQ = sortQ.eq("restaurant_id", restaurant_id);
  const { data: lastRow } = await sortQ.maybeSingle();
  const sort_order = ((lastRow?.sort_order as number) ?? -1) + 1;

  const { data, error } = await supabase
    .from("payment_methods")
    .insert({ restaurant_id, slug, name, description, kind, color, sort_order })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true, data: data as PaymentMethodConfig };
}

export async function updatePaymentMethod(formData: FormData): Promise<Result> {
  await requireRole(["admin", "owner"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!id) return { ok: false, error: "ID tidak ada" };
  if (!name) return { ok: false, error: "Nama metode wajib diisi" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_methods")
    .update({ name, description, color, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}

export async function togglePaymentMethodActive(id: string, is_active: boolean): Promise<Result> {
  await requireRole(["admin", "owner"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_methods")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}

export async function deletePaymentMethod(id: string): Promise<Result> {
  await requireRole(["admin", "owner"]);
  const supabase = await createClient();
  const { error } = await supabase.from("payment_methods").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}

// =============================================================================
// Payment providers
// =============================================================================

export async function createPaymentProvider(formData: FormData): Promise<Result<PaymentProviderConfig>> {
  const profile = await requireRole(["admin", "owner"]);
  const payment_method_id = String(formData.get("payment_method_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!payment_method_id) return { ok: false, error: "Metode pembayaran tidak ada" };
  if (!name) return { ok: false, error: "Nama provider wajib diisi" };

  const supabase = await createClient();
  const restaurant_id = getRestaurantFilter(profile);

  // Ensure slug is unique under this method
  const baseSlug = slugify(name) || "provider";
  let slug = baseSlug;
  for (let i = 2; i < 100; i++) {
    const { data: exists } = await supabase
      .from("payment_providers")
      .select("id")
      .eq("payment_method_id", payment_method_id)
      .eq("slug", slug)
      .maybeSingle();
    if (!exists) break;
    slug = `${baseSlug}_${i}`;
  }

  const { data: lastRow } = await supabase
    .from("payment_providers")
    .select("sort_order")
    .eq("payment_method_id", payment_method_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = ((lastRow?.sort_order as number) ?? -1) + 1;

  const { data, error } = await supabase
    .from("payment_providers")
    .insert({ payment_method_id, restaurant_id, slug, name, description, color, sort_order })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true, data: data as PaymentProviderConfig };
}

export async function updatePaymentProvider(formData: FormData): Promise<Result> {
  await requireRole(["admin", "owner"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!id) return { ok: false, error: "ID tidak ada" };
  if (!name) return { ok: false, error: "Nama provider wajib diisi" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_providers")
    .update({ name, description, color, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}

export async function togglePaymentProviderActive(id: string, is_active: boolean): Promise<Result> {
  await requireRole(["admin", "owner"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_providers")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}

export async function deletePaymentProvider(id: string): Promise<Result> {
  await requireRole(["admin", "owner"]);
  const supabase = await createClient();
  const { error } = await supabase.from("payment_providers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}

// =============================================================================
// Tax & service settings (restaurant-level)
// =============================================================================

export async function updateTaxService(formData: FormData): Promise<Result> {
  const profile = await requireRole(["admin", "owner"]);
  const restaurant_id = getRestaurantFilter(profile);
  if (!restaurant_id) return { ok: false, error: "Tidak terhubung ke restoran" };

  const taxEnabled = formData.get("tax_enabled") === "on" || formData.get("tax_enabled") === "true";
  const serviceEnabled = formData.get("service_enabled") === "on" || formData.get("service_enabled") === "true";
  const round = formData.get("round_total") === "on" || formData.get("round_total") === "true";

  const taxPercent = Number(formData.get("tax_rate") ?? 0);
  const servicePercent = Number(formData.get("service_charge_rate") ?? 0);
  const tax_rate = taxEnabled ? Math.max(0, Math.min(1, taxPercent / 100)) : 0;
  const service_charge_rate = serviceEnabled ? Math.max(0, Math.min(1, servicePercent / 100)) : 0;

  const channelsRaw = formData.getAll("service_charge_channels").map((v) => String(v));
  const supabase = await createClient();

  // Service charge only applies to direct-kind (or unclassified) channels.
  // Drop anything else server-side so a stale form (or a manual SQL hack)
  // can't widen the charge to apps/online channels.
  let service_charge_channels: string[] = [];
  if (serviceEnabled && channelsRaw.length > 0) {
    const { data: chRows } = await supabase
      .from("order_channels")
      .select("id, kind")
      .eq("restaurant_id", restaurant_id)
      .in("id", channelsRaw);
    const allowed = new Set(
      ((chRows ?? []) as Array<{ id: string; kind: string | null }>)
        .filter((c) => c.kind === "direct" || c.kind === null)
        .map((c) => c.id),
    );
    service_charge_channels = channelsRaw.filter((id) => allowed.has(id));
  }

  const { error } = await supabase
    .from("restaurants")
    .update({ tax_rate, service_charge_rate, service_charge_channels, round_total: round })
    .eq("id", restaurant_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true };
}
