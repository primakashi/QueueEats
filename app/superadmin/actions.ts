"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateRestaurantSubscription(
  restaurantId: string,
  endDate: string | null,
  notes: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["super_admin"]);
  if (!restaurantId) return { ok: false, error: "ID restoran tidak ada" };

  const trimmedNotes = notes?.trim() || null;
  const normalizedDate = endDate?.trim() ? endDate.trim() : null;

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("restaurants")
    .update({
      subscription_end_date: normalizedDate,
      subscription_notes: trimmedNotes,
    })
    .eq("id", restaurantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/superadmin");
  return { ok: true };
}
