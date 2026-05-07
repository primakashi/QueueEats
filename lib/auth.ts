import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

export const PROFILE_COOKIE = "qe_profile";

const PROFILE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function isProfileShape(value: unknown): value is Profile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.full_name === "string" &&
    typeof v.role === "string" &&
    typeof v.created_at === "string"
  );
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Reads the profile from the `qe_profile` cookie set at login. We deliberately
 * skip `auth.getUser()` and a `profiles` SELECT here so that role-gated pages
 * don't pay a Supabase round-trip on every navigation. Tamper-resistance is
 * intentionally traded for speed; data security still relies on RLS.
 *
 * Wrapped in `cache()` so multiple `requireRole` calls in the same render
 * reuse a single JSON.parse.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const store = await cookies();
  const raw = store.get(PROFILE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isProfileShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
});

export async function setProfileCookie(profile: Profile): Promise<void> {
  const store = await cookies();
  store.set(PROFILE_COOKIE, JSON.stringify(profile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PROFILE_MAX_AGE_SECONDS,
  });
}

export async function clearProfileCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PROFILE_COOKIE);
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireRole(
  roles: UserRole[],
): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/403");
  return profile;
}

export function homeForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin/menu";
    case "kitchen":
      return "/kitchen";
    case "cashier":
      return "/cashier";
    case "waiter":
    default:
      return "/waiter";
  }
}
