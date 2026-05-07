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
    return { error: "Email and password are required" };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  const userId = signInData.user?.id;
  if (!userId) return { error: "Sign-in succeeded but no user was returned" };

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
    return { error: "No profile found for this account" };
  }

  const profile = profileRow as Profile;
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
