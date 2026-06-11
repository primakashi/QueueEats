"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

// ========== Categories ==========

export async function createCategory(formData: FormData): Promise<Result> {
  await requireRole(["admin"]);
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  if (!name) return { ok: false, error: "Nama wajib diisi" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_categories")
    .insert({ name, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0 });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function updateCategory(formData: FormData): Promise<Result> {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  if (!id || !name) return { ok: false, error: "Data tidak lengkap" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_categories")
    .update({ name, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0 })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<Result> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("menu_categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

// ========== Menu items ==========

async function uploadImage(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const supabase = await createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `items/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("menu-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function createMenuItem(formData: FormData): Promise<Result> {
  const profile = await requireRole(["admin"]);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const price = Number(formData.get("price") ?? 0);
  const category_id = String(formData.get("category_id") ?? "") || null;
  const is_available = formData.get("is_available") === "on";
  const imageFile = formData.get("image") as File | null;

  if (!name) return { ok: false, error: "Nama wajib diisi" };
  if (!Number.isFinite(price) || price < 0)
    return { ok: false, error: "Harga harus angka tidak negatif" };

  let image_url: string | null = null;
  try {
    image_url = await uploadImage(imageFile);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("menu_items")
    .insert({ name, description, price, category_id, is_available, image_url })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
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
  const profile = await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const price = Number(formData.get("price") ?? 0);
  const category_id = String(formData.get("category_id") ?? "") || null;
  const is_available = formData.get("is_available") === "on";
  const imageFile = formData.get("image") as File | null;

  if (!id) return { ok: false, error: "ID tidak ada" };
  if (!name) return { ok: false, error: "Nama wajib diisi" };
  if (!Number.isFinite(price) || price < 0)
    return { ok: false, error: "Harga harus angka tidak negatif" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("menu_items")
    .select("name, price")
    .eq("id", id)
    .single();

  const update: Record<string, unknown> = {
    name,
    description,
    price,
    category_id,
    is_available,
  };

  if (imageFile && imageFile.size > 0) {
    try {
      update.image_url = await uploadImage(imageFile);
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  const { error } = await supabase
    .from("menu_items")
    .update(update)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (existing) {
    const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    if (existing.price !== price)
      changes.push({ field: "price", oldValue: String(existing.price), newValue: String(price) });
    if (existing.name !== name)
      changes.push({ field: "name", oldValue: existing.name, newValue: name });
    if (changes.length > 0) {
      await logAudit(profile, {
        table: "menu_items",
        recordId: id,
        entityName: name,
        action: "update",
        changes,
      });
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
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: available })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function deleteMenuItem(id: string): Promise<Result> {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("menu_items")
    .select("name, price")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
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
  role: "waiter" | "kitchen" | "cashier" | "admin" | "owner",
): Promise<Result> {
  const profile = await requireRole(["admin", "owner"]);
  const isOwnerCaller = profile.role === "owner";
  if (!isOwnerCaller && role === "owner") return { ok: false, error: "Peran owner tidak dapat ditetapkan oleh admin" };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", id)
    .single();
  if (!isOwnerCaller && existing?.role === "owner") return { ok: false, error: "Akun owner tidak dapat diubah oleh admin" };
  const { error } = await supabase
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
  const caller = await requireRole(["admin", "owner"]);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "waiter") as "waiter" | "kitchen" | "cashier" | "admin" | "owner";

  if (!email) return { ok: false, error: "Email wajib diisi" };
  if (!fullName) return { ok: false, error: "Nama wajib diisi" };
  if (!password || password.length < 6) return { ok: false, error: "Kata sandi minimal 6 karakter" };
  if (caller.role !== "owner" && role === "owner") return { ok: false, error: "Peran owner tidak dapat dibuat oleh admin" };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createAdminClient();

  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authErr) return { ok: false, error: authErr.message };
  if (!authData.user) return { ok: false, error: "Gagal membuat akun" };

  const regularClient = await createClient();
  const { error: profileErr } = await regularClient
    .from("profiles")
    .upsert({ id: authData.user.id, full_name: fullName, role }, { onConflict: "id" });
  if (profileErr) return { ok: false, error: profileErr.message };

  revalidatePath("/admin/users");
  return { ok: true };
}
