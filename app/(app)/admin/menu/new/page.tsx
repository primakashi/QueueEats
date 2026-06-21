import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type { MenuCategory, OrderChannelConfig } from "@/lib/types";
import { MenuItemForm } from "../menu-item-form";
import { MenuItemFormSkeleton } from "../menu-item-form-skeleton";

export default async function NewMenuItemPage() {
  await requireRole(["admin", "branch_manager", "cashier"]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Item menu baru" description="Tambahkan item baru ke menu" />
      <Suspense fallback={<MenuItemFormSkeleton />}>
        <NewFormLoader />
      </Suspense>
    </div>
  );
}

async function NewFormLoader() {
  const profile = await requireRole(["admin", "branch_manager", "cashier"]);
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);

  let catsQ = supabase.from("menu_categories").select("*");
  let chQ = supabase
    .from("order_channels")
    .select("id, name, sort_order, is_active, kind, commission_rate")
    .eq("is_active", true);
  if (rid) {
    catsQ = catsQ.eq("restaurant_id", rid);
    chQ = chQ.eq("restaurant_id", rid);
  }
  const [{ data: cats }, { data: channels }] = await Promise.all([
    catsQ.order("sort_order", { ascending: true }),
    chQ.order("sort_order", { ascending: true }),
  ]);
  return (
    <MenuItemForm
      categories={(cats ?? []) as MenuCategory[]}
      channels={(channels ?? []) as OrderChannelConfig[]}
    />
  );
}
