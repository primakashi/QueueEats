"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { Outlet } from "@/lib/types";

type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

export async function createOutlet(formData: FormData): Promise<Result<Outlet>> {
  await requireRole(["admin"]);
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const is_temporary = formData.get("is_temporary") === "true";
  const active_from = String(formData.get("active_from") ?? "").trim() || null;
  const active_until = String(formData.get("active_until") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Nama outlet wajib diisi" };
  if (is_temporary && !active_from) {
    return { ok: false, error: "Outlet sementara harus memiliki tanggal mulai" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outlets")
    .insert({ name, location, is_temporary, active_from, active_until })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/outlets");
  revalidatePath("/waiter/new");
  return { ok: true, data: data as Outlet };
}

export async function updateOutlet(formData: FormData): Promise<Result> {
  await requireRole(["admin"]);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const is_temporary = formData.get("is_temporary") === "true";
  const active_from = String(formData.get("active_from") ?? "").trim() || null;
  const active_until = String(formData.get("active_until") ?? "").trim() || null;

  if (!id) return { ok: false, error: "ID tidak ada" };
  if (!name) return { ok: false, error: "Nama outlet wajib diisi" };
  if (is_temporary && !active_from) {
    return { ok: false, error: "Outlet sementara harus memiliki tanggal mulai" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("outlets")
    .update({ name, location, is_temporary, active_from, active_until })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/outlets");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function archiveOutlet(id: string): Promise<Result> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("outlets")
    .update({ is_archived: true })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/outlets");
  revalidatePath("/waiter/new");
  return { ok: true };
}

export async function restoreOutlet(id: string): Promise<Result> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("outlets")
    .update({ is_archived: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/outlets");
  revalidatePath("/waiter/new");
  return { ok: true };
}
