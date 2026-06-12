"use server";

import { createClient } from "@/lib/supabase/server";

export async function updatePassword(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password || password.length < 6) {
    return { ok: false, error: "Kata sandi minimal 6 karakter" };
  }
  if (password !== confirm) {
    return { ok: false, error: "Konfirmasi kata sandi tidak cocok" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
