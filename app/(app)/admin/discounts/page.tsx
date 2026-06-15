import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type { Discount, MenuItem } from "@/lib/types";
import { DiscountsManager } from "./discounts-manager";

export default async function DiscountsPage() {
  const profile = await requireRole(["admin", "owner", "branch_manager", "cashier", "waiter"]);
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);

  let discountsQ = supabase.from("discounts").select("*");
  let menuQ = supabase.from("menu_items").select("id, name");
  if (rid) {
    discountsQ = discountsQ.eq("restaurant_id", rid);
    menuQ = menuQ.eq("restaurant_id", rid);
  }

  const [{ data: discounts }, { data: menuItems }] = await Promise.all([
    discountsQ.order("created_at", { ascending: false }),
    menuQ.order("name"),
  ]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Diskon"
        description="Atur diskon per item, per transaksi, atau promo harian."
      />
      <DiscountsManager
        discounts={(discounts ?? []) as Discount[]}
        menuItems={(menuItems ?? []) as Pick<MenuItem, "id" | "name">[]}
      />
    </div>
  );
}
