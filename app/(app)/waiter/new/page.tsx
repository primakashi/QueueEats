import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type {
  DailyStock,
  MenuCategory,
  MenuItem,
  OrderChannelConfig,
  Outlet,
} from "@/lib/types";
import { NewOrderClient } from "./new-order-client";

export default async function NewOrderPage() {
  const profile = await requireRole(["waiter", "cashier", "admin", "branch_manager"]);
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);

  let itemsQ = supabase.from("menu_items").select("*").eq("is_available", true);
  let catsQ = supabase.from("menu_categories").select("*");
  let outletsQ = supabase.from("outlets").select("id, name, is_temporary").eq("is_archived", false);
  let channelsQ = supabase.from("order_channels").select("id, name, sort_order, is_active, kind, commission_rate").eq("is_active", true);
  let stockQ = supabase
    .from("daily_stock")
    .select("id, outlet_id, menu_item_id, current_stock, is_active, daily_quota, opening_stock, stock_date, restaurant_id, confirmed_at, confirmed_by, created_by, created_at, updated_at")
    .eq("stock_date", new Date().toLocaleDateString("en-CA"));
  if (rid) {
    itemsQ = itemsQ.eq("restaurant_id", rid);
    catsQ = catsQ.eq("restaurant_id", rid);
    outletsQ = outletsQ.eq("restaurant_id", rid);
    channelsQ = channelsQ.eq("restaurant_id", rid);
    stockQ = stockQ.eq("restaurant_id", rid);
  }

  const [
    { data: items },
    { data: categories },
    { data: outlets },
    { data: channels },
    { data: stocks },
  ] = await Promise.all([
    itemsQ.order("sort_order", { ascending: true }).order("name", { ascending: true }),
    catsQ.order("sort_order", { ascending: true }),
    outletsQ.order("created_at", { ascending: true }),
    channelsQ.order("sort_order", { ascending: true }),
    stockQ,
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Pesanan baru"
        description="Pilih item, tinjau keranjang, dan kirim ke dapur"
      />
      <NewOrderClient
        items={(items ?? []) as MenuItem[]}
        categories={(categories ?? []) as MenuCategory[]}
        outlets={(outlets ?? []) as Pick<Outlet, "id" | "name" | "is_temporary">[]}
        channels={(channels ?? []) as OrderChannelConfig[]}
        dailyStocks={(stocks ?? []) as DailyStock[]}
      />
    </div>
  );
}
