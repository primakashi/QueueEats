"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { type UserRole, HQ_ROLES } from "@/lib/types";

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

// ========== Categories ==========

export async function createCategory(formData: FormData): Promise<Result> {
  const profile = await requireRole(["admin", "branch_manager", "cashier"]);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Nama wajib diisi" };
  const restaurant_id = getRestaurantFilter(profile);

  const supabase = await createClient();
  const adminClient = createAdminClient();
  // Auto-append to end of list.
  let maxQ = supabase
    .from("menu_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (restaurant_id) maxQ = maxQ.eq("restaurant_id", restaurant_id);
  const { data: lastRow } = await maxQ.maybeSingle();
  const sort_order = ((lastRow?.sort_order as number) ?? -1) + 1;

  const { error } = await adminClient
    .from("menu_categories")
    .insert({ name, sort_order, restaurant_id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function reorderCategories(orderedIds: string[]): Promise<Result> {
  const profile = await requireRole(["admin", "branch_manager"]);
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, error: "Urutan tidak valid" };
  }
  const rid = getRestaurantFilter(profile);
  const supabase = await createClient();

  // Update each category's sort_order to its position in the array.
  for (let i = 0; i < orderedIds.length; i++) {
    let q = supabase.from("menu_categories").update({ sort_order: i }).eq("id", orderedIds[i]);
    if (rid) q = q.eq("restaurant_id", rid);
    const { error } = await q;
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function updateCategory(formData: FormData): Promise<Result> {
  const profile = await requireRole(["admin", "branch_manager"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return { ok: false, error: "Data tidak lengkap" };

  const rid = getRestaurantFilter(profile);
  const supabase = await createClient();
  let q = supabase.from("menu_categories").update({ name }).eq("id", id);
  if (rid) q = q.eq("restaurant_id", rid);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<Result> {
  const profile = await requireRole(["admin", "branch_manager"]);
  const rid = getRestaurantFilter(profile);
  const supabase = await createClient();
  let q = supabase.from("menu_categories").delete().eq("id", id);
  if (rid) q = q.eq("restaurant_id", rid);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

// ========== Menu items ==========

// Form posts commission as a percent (e.g. "12.5"). Empty = null (inherit
// from channel). Clamped to [0, 100] and stored as a 0–1 fraction to match
// order_channels.commission_rate.
function parseCommissionPercent(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const pct = Number(s);
  if (!Number.isFinite(pct) || pct < 0) return null;
  return Math.min(1, pct / 100);
}

// Reorder menu items within a category (or within "no category" when
// categoryId is null). Writes 0..N to each item's sort_order in array order.
// Items not in the array are left untouched.
export async function reorderMenuItems(
  categoryId: string | null,
  orderedIds: string[],
): Promise<Result> {
  const profile = await requireRole(["admin", "branch_manager"]);
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, error: "Urutan tidak valid" };
  }
  const rid = getRestaurantFilter(profile);
  const supabase = await createClient();

  for (let i = 0; i < orderedIds.length; i++) {
    let q = supabase
      .from("menu_items")
      .update({ sort_order: i, updated_at: new Date().toISOString() })
      .eq("id", orderedIds[i]);
    if (rid) q = q.eq("restaurant_id", rid);
    if (categoryId === null) q = q.is("category_id", null);
    else q = q.eq("category_id", categoryId);
    const { error } = await q;
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

async function uploadImage(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const adminClient = createAdminClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `items/${randomUUID()}.${ext}`;
  const { error } = await adminClient.storage
    .from("menu-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = adminClient.storage.from("menu-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function createMenuItem(formData: FormData): Promise<Result> {
  const profile = await requireRole(["admin", "branch_manager", "cashier"]);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const price = Number(formData.get("price") ?? 0);
  const costRaw = formData.get("cost_price");
  const cost_price = costRaw == null || costRaw === "" ? null : Number(costRaw);
  const sortRaw = Number(formData.get("sort_order") ?? 0);
  let sort_order = Number.isFinite(sortRaw) ? Math.trunc(sortRaw) : 0;
  const category_id = String(formData.get("category_id") ?? "") || null;
  const is_available = formData.get("is_available") === "on";
  const imageFile = formData.get("image") as File | null;
  const commission_rate = parseCommissionPercent(formData.get("commission_rate"));

  if (!name) return { ok: false, error: "Nama wajib diisi" };
  if (!Number.isFinite(price) || price < 0)
    return { ok: false, error: "Harga harus angka tidak negatif" };
  if (cost_price !== null && (!Number.isFinite(cost_price) || cost_price < 0))
    return { ok: false, error: "HPP harus angka tidak negatif" };

  let image_url: string | null = null;
  try {
    image_url = await uploadImage(imageFile);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const restaurant_id = getRestaurantFilter(profile);
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // If the form leaves sort_order at the default 0, append to the end of the
  // category so manual drag-order isn't immediately disturbed by new items.
  if (sort_order <= 0) {
    let maxQ = supabase
      .from("menu_items")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    if (restaurant_id) maxQ = maxQ.eq("restaurant_id", restaurant_id);
    if (category_id === null) maxQ = maxQ.is("category_id", null);
    else maxQ = maxQ.eq("category_id", category_id);
    const { data: lastRow } = await maxQ.maybeSingle();
    sort_order = ((lastRow?.sort_order as number | null) ?? -1) + 1;
  }

  const { data: inserted, error } = await adminClient
    .from("menu_items")
    .insert({ name, description, price, cost_price, sort_order, category_id, is_available, image_url, restaurant_id, commission_rate })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Channel assignment (F01). Empty selection = available on every channel.
  const channelIds = formData.getAll("channel_ids").map((v) => String(v)).filter(Boolean);
  if (channelIds.length > 0) {
    const rows = channelIds.map((channel_id) => ({ menu_item_id: inserted.id, channel_id }));
    const { error: chErr } = await adminClient.from("menu_item_channels").insert(rows);
    if (chErr) return { ok: false, error: chErr.message };
  }

  await logAudit(profile, {
    table: "menu_items",
    recordId: inserted.id,
    entityName: name,
    action: "create",
    changes: [{ field: "price", oldValue: null, newValue: String(price) }],
  });
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function updateMenuItem(formData: FormData): Promise<Result> {
  const profile = await requireRole(["admin", "branch_manager"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const price = Number(formData.get("price") ?? 0);
  const costRaw = formData.get("cost_price");
  const cost_price = costRaw == null || costRaw === "" ? null : Number(costRaw);
  const sortRawEntry = formData.get("sort_order");
  const sort_order = sortRawEntry != null
    ? (Number.isFinite(Number(sortRawEntry)) ? Math.trunc(Number(sortRawEntry)) : null)
    : null;
  const category_id = String(formData.get("category_id") ?? "") || null;
  const is_available = formData.get("is_available") === "on";
  const imageFile = formData.get("image") as File | null;

  if (!id) return { ok: false, error: "ID tidak ada" };
  if (!name) return { ok: false, error: "Nama wajib diisi" };
  if (!Number.isFinite(price) || price < 0)
    return { ok: false, error: "Harga harus angka tidak negatif" };
  if (cost_price !== null && (!Number.isFinite(cost_price) || cost_price < 0))
    return { ok: false, error: "HPP harus angka tidak negatif" };

  const rid = getRestaurantFilter(profile);
  const supabase = await createClient();

  // Fetch existing (for audit) and upload image in parallel.
  let existingQ = supabase.from("menu_items").select("name, price").eq("id", id);
  if (rid) existingQ = existingQ.eq("restaurant_id", rid);
  const imageUploadPromise =
    imageFile && imageFile.size > 0
      ? uploadImage(imageFile).catch((e: unknown) => { throw e; })
      : Promise.resolve(null);

  let existing: { name: string; price: number } | null = null;
  let image_url: string | null = null;
  try {
    [{ data: existing }, image_url] = await Promise.all([existingQ.single(), imageUploadPromise]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const update: Record<string, unknown> = {
    name,
    description,
    price,
    cost_price,
    category_id,
    is_available,
    commission_rate: parseCommissionPercent(formData.get("commission_rate")),
    ...(sort_order !== null ? { sort_order } : {}),
    ...(image_url ? { image_url } : {}),
  };

  // Run DB update and channel delete in parallel.
  let updateQ = supabase.from("menu_items").update(update).eq("id", id);
  if (rid) updateQ = updateQ.eq("restaurant_id", rid);
  const [updateResult] = await Promise.all([
    updateQ,
    supabase.from("menu_item_channels").delete().eq("menu_item_id", id),
  ]);
  if (updateResult.error) return { ok: false, error: updateResult.error.message };

  // Channel assignment (F01). Diff-replace: empty list = available everywhere.
  const channelIds = formData.getAll("channel_ids").map((v) => String(v)).filter(Boolean);
  const auditChanges: { field: string; oldValue: string | null; newValue: string | null }[] = [];
  if (existing) {
    if (existing.price !== price)
      auditChanges.push({ field: "price", oldValue: String(existing.price), newValue: String(price) });
    if (existing.name !== name)
      auditChanges.push({ field: "name", oldValue: existing.name, newValue: name });
  }

  // Re-insert channels and log audit in parallel.
  const tasks: Promise<unknown>[] = [];
  if (channelIds.length > 0) {
    const rows = channelIds.map((channel_id) => ({ menu_item_id: id, channel_id }));
    tasks.push(
      (async () => {
        const { error: chErr } = await supabase.from("menu_item_channels").insert(rows);
        if (chErr) throw new Error(chErr.message);
      })(),
    );
  }
  if (auditChanges.length > 0) {
    tasks.push(logAudit(profile, { table: "menu_items", recordId: id, entityName: name, action: "update", changes: auditChanges }));
  }
  if (tasks.length > 0) {
    try {
      await Promise.all(tasks);
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  revalidatePath("/admin/menu");
  revalidatePath(`/admin/menu/${id}/edit`);
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function toggleMenuItemAvailability(
  id: string,
  available: boolean,
): Promise<Result> {
  const profile = await requireRole(["admin", "branch_manager"]);
  const rid = getRestaurantFilter(profile);
  const supabase = await createClient();
  let q = supabase.from("menu_items").update({ is_available: available }).eq("id", id);
  if (rid) q = q.eq("restaurant_id", rid);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function deleteMenuItem(id: string): Promise<Result> {
  const profile = await requireRole(["admin", "branch_manager"]);
  const rid = getRestaurantFilter(profile);
  const supabase = await createClient();
  let existingQ = supabase.from("menu_items").select("name, price").eq("id", id);
  if (rid) existingQ = existingQ.eq("restaurant_id", rid);
  const { data: existing } = await existingQ.single();
  let deleteQ = supabase.from("menu_items").delete().eq("id", id);
  if (rid) deleteQ = deleteQ.eq("restaurant_id", rid);
  const { error } = await deleteQ;
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, {
    table: "menu_items",
    recordId: id,
    entityName: existing?.name ?? id,
    action: "delete",
    changes: existing
      ? [{ field: "price", oldValue: String(existing.price), newValue: null }]
      : undefined,
  });
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

// ========== Staff (profiles) ==========

export async function updateStaffRole(
  id: string,
  role: UserRole,
): Promise<Result> {
  const profile = await requireRole(["admin", "owner"]);
  const isOwnerCaller = profile.role === "owner";
  if (!isOwnerCaller && role === "owner") return { ok: false, error: "Peran owner tidak dapat ditetapkan oleh admin" };
  const adminClient = createAdminClient();
  const { data: existing } = await adminClient
    .from("profiles")
    .select("full_name, role")
    .eq("id", id)
    .single();
  if (!isOwnerCaller && existing?.role === "owner") return { ok: false, error: "Akun owner tidak dapat diubah oleh admin" };
  const { error } = await adminClient
    .from("profiles")
    .update({ role })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (existing) {
    await logAudit(profile, {
      table: "profiles",
      recordId: id,
      entityName: existing.full_name,
      action: "update",
      changes: [{ field: "role", oldValue: existing.role, newValue: role }],
    });
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteStaff(id: string): Promise<Result> {
  const profile = await requireRole(["admin", "owner"]);
  if (profile.id === id) return { ok: false, error: "Tidak dapat menghapus akun sendiri" };

  const regularClientCheck = await createClient();
  const { data: target } = await regularClientCheck.from("profiles").select("role").eq("id", id).single();
  if (profile.role !== "owner" && target?.role === "owner") return { ok: false, error: "Akun owner tidak dapat dihapus oleh admin" };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createAdminClient();

  const regularClient = await createClient();
  await regularClient.from("profiles").delete().eq("id", id);

  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function inviteStaff(formData: FormData): Promise<Result> {
  const caller = await requireRole(["admin", "owner", "branch_manager"]);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "waiter") as UserRole;
  const outletIdRaw = String(formData.get("outlet_id") ?? "").trim();
  const outletId = outletIdRaw || null;

  if (!email) return { ok: false, error: "Email wajib diisi" };
  if (!fullName) return { ok: false, error: "Nama wajib diisi" };
  if (!password || password.length < 6) return { ok: false, error: "Kata sandi minimal 6 karakter" };
  if (caller.role !== "owner" && role === "owner") return { ok: false, error: "Peran owner tidak dapat dibuat oleh admin" };
  if (caller.role === "branch_manager" && !HQ_ROLES.includes(role) && outletId !== caller.outlet_id) {
    return { ok: false, error: "Tidak dapat membuat akun untuk outlet lain" };
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createAdminClient();

  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authErr) {
    const msg = authErr.message.toLowerCase();
    if (msg.includes("already been registered") || msg.includes("already registered") || msg.includes("email_exists")) {
      return { ok: false, error: "Email sudah terdaftar. Gunakan email lain." };
    }
    return { ok: false, error: authErr.message };
  }
  if (!authData.user) return { ok: false, error: "Gagal membuat akun" };

  const restaurantId = getRestaurantFilter(caller);
  const { error: profileErr } = await adminClient
    .from("profiles")
    .upsert({ id: authData.user.id, full_name: fullName, role, outlet_id: outletId, restaurant_id: restaurantId }, { onConflict: "id" });
  if (profileErr) return { ok: false, error: profileErr.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

type PasswordResetResult =
  | { ok: true; emailed: boolean; link: string }
  | { ok: false; error: string };

export async function resetStaffPassword(staffId: string): Promise<PasswordResetResult> {
  const profile = await requireRole(["admin", "owner"]);

  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", staffId)
    .maybeSingle();
  if (!staff) return { ok: false, error: "Akun tidak ditemukan" };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createAdminClient();

  const { data: authUser } = await adminClient.auth.admin.getUserById(staffId);
  if (!authUser.user?.email) return { ok: false, error: "Email akun tidak ditemukan" };

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: authUser.user.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login/update-password`,
    },
  });
  if (error || !data?.properties?.action_link) {
    return { ok: false, error: error?.message ?? "Gagal membuat link reset" };
  }
  const actionLink = data.properties.action_link;

  // Best-effort email. If it fails (Resend not configured, network, etc.) we
  // still hand the link back to the admin so they can deliver it manually.
  let emailed = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const { error: emailErr } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@solusissaji.com",
        to: authUser.user.email,
        subject: "Reset Kata Sandi — Solusi Saji POS",
        html: `
          <p>Halo,</p>
          <p>Admin telah meminta reset kata sandi untuk akun Anda.</p>
          <p>
            <a href="${actionLink}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
              Reset Kata Sandi
            </a>
          </p>
          <p>Link ini berlaku selama 1 jam.</p>
          <p>— Tim Solusi Saji</p>
        `,
      });
      emailed = !emailErr;
    } catch {
      emailed = false;
    }
  }

  try {
    await logAudit(profile, {
      table: "profiles",
      recordId: staffId,
      entityName: (staff as { full_name: string }).full_name ?? authUser.user.email,
      action: "update",
      changes: [
        { field: "password_reset", oldValue: null, newValue: emailed ? "emailed" : "link_only" },
      ],
    });
  } catch { /* audit logging is best-effort */ }

  return { ok: true, emailed, link: actionLink };
}
