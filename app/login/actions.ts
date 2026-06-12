"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  clearProfileCookie,
  homeForRole,
  setProfileCookie,
} from "@/lib/auth";
import type { Profile } from "@/lib/types";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "");

  if (!email || !password) {
    return { error: "Email dan kata sandi wajib diisi" };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  const userId = signInData.user?.id;
  if (!userId) return { error: "Masuk berhasil tetapi tidak ada data pengguna" };

  // Fetch the profile once and stash it in a cookie. From here on, every
  // server render reads the role from the cookie instead of doing another
  // auth round-trip + profiles SELECT.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!profileRow) {
    await supabase.auth.signOut();
    return { error: "Tidak ada profil untuk akun ini" };
  }

  const raw = profileRow as Record<string, unknown>;
  const profile: Profile = {
    ...(raw as unknown as Profile),
    outlet_id: (raw.outlet_id as string | null) ?? null,
    restaurant_id: (raw.restaurant_id as string | null) ?? null,
  };
  await setProfileCookie(profile);

  if (redirectTo && redirectTo.startsWith("/")) {
    redirect(redirectTo);
  }
  redirect(homeForRole(profile.role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearProfileCookie();
  redirect("/login");
}
