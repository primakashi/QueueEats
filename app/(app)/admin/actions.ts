"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

// ========== Categories ==========

export async function createCategory(formData: FormData): Promise<Result> {
  await requireRole(["admin"]);
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  if (!name) return { ok: false, error: "Name is required" };

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
  if (!id || !name) return { ok: false, error: "Missing fields" };

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
  await requireRole(["admin"]);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const price = Number(formData.get("price") ?? 0);
  const category_id = String(formData.get("category_id") ?? "") || null;
  const is_available = formData.get("is_available") === "on";
  const imageFile = formData.get("image") as File | null;

  if (!name) return { ok: false, error: "Name is required" };
  if (!Number.isFinite(price) || price < 0)
    return { ok: false, error: "Price must be a non-negative number" };

  let image_url: string | null = null;
  try {
    image_url = await uploadImage(imageFile);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").insert({
    name,
    description,
    price,
    category_id,
    is_available,
    image_url,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function updateMenuItem(formData: FormData): Promise<Result> {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const price = Number(formData.get("price") ?? 0);
  const category_id = String(formData.get("category_id") ?? "") || null;
  const is_available = formData.get("is_available") === "on";
  const imageFile = formData.get("image") as File | null;

  if (!id) return { ok: false, error: "Missing id" };
  if (!name) return { ok: false, error: "Name is required" };
  if (!Number.isFinite(price) || price < 0)
    return { ok: false, error: "Price must be a non-negative number" };

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

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update(update)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
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
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/menu");
  revalidatePath("/waiter/new");
  return { ok: true };
}

// ========== Staff (profiles) ==========

export async function updateStaffRole(
  id: string,
  role: "waiter" | "kitchen" | "cashier" | "admin",
): Promise<Result> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  // Note: the affected user's cached profile lives in their `qe_profile`
  // cookie and won't reflect this change until they sign out and back in.
  // Acceptable for an internal POS where role changes are rare.
  return { ok: true };
}
