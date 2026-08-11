import { NextResponse } from "next/server";
import { getVerifiedProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export async function requireHostApiAuth(): Promise<
  | { ok: true; profile: Profile }
  | { ok: false; response: NextResponse }
> {
  const profile = await getVerifiedProfile();
  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (profile.role !== "waiter" && profile.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, profile };
}
