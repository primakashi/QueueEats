"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function onboardRestaurant(
  formData: FormData,
): Promise<{ ok: false; error: string } | never> {
  await requireRole(["super_admin"]);

  const restaurantName = String(formData.get("restaurant_name") ?? "").trim();
  const ownerName = String(formData.get("owner_name") ?? "").trim();
  const ownerEmail = String(formData.get("owner_email") ?? "").trim().toLowerCase();
  const ownerPassword = String(formData.get("owner_password") ?? "");
  const outletName = String(formData.get("outlet_name") ?? "").trim();
  const outletLocation = String(formData.get("outlet_location") ?? "").trim();

  if (!restaurantName) return { ok: false, error: "Nama restoran wajib diisi" };
  if (!ownerName) return { ok: false, error: "Nama owner wajib diisi" };
  if (!ownerEmail) return { ok: false, error: "Email owner wajib diisi" };
  if (!ownerPassword || ownerPassword.length < 6) return { ok: false, error: "Kata sandi minimal 6 karakter" };
  if (!outletName) return { ok: false, error: "Nama outlet wajib diisi" };

  const adminClient = createAdminClient();

  // 1. Create restaurant (use adminClient to bypass RLS)
  const { data: restaurant, error: rErr } = await adminClient
    .from("restaurants")
    .insert({ name: restaurantName })
    .select()
    .single();
  if (rErr || !restaurant) return { ok: false, error: rErr?.message ?? "Gagal membuat restoran" };

  const restaurantId = restaurant.id as string;

  // 2. Create auth user
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    user_metadata: { full_name: ownerName },
  });
  if (authErr || !authData.user) {
    await adminClient.from("restaurants").delete().eq("id", restaurantId);
    const msg = authErr?.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("registered") || msg.includes("email_exists")) {
      return { ok: false, error: "Email sudah terdaftar. Gunakan email lain." };
    }
    return { ok: false, error: authErr?.message ?? "Gagal membuat akun owner" };
  }

  // 3. Create owner profile
  const { error: profileErr } = await adminClient.from("profiles").upsert({
    id: authData.user.id,
    full_name: ownerName,
    role: "owner",
    restaurant_id: restaurantId,
    outlet_id: null,
  }, { onConflict: "id" });
  if (profileErr) {
    await adminClient.from("restaurants").delete().eq("id", restaurantId);
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return { ok: false, error: profileErr.message };
  }

  // 4. Create first outlet (use adminClient to bypass RLS)
  const { error: outletErr } = await adminClient.from("outlets").insert({
    name: outletName,
    location: outletLocation || null,
    restaurant_id: restaurantId,
    is_temporary: false,
    is_archived: false,
  });
  if (outletErr) {
    await adminClient.from("restaurants").delete().eq("id", restaurantId);
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return { ok: false, error: outletErr.message };
  }

  redirect("/superadmin");
}
