import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type {
  DailyStock,
  MenuCategory,
  MenuItem,
  MenuItemChannel,
  OrderChannelConfig,
  Outlet,
} from "@/lib/types";
import { NewOrderClient, type AddonContext } from "./new-order-client";

type Props = { searchParams: Promise<{ addon?: string }> };

export default async function NewOrderPage({ searchParams }: Props) {
  const profile = await requireRole(["waiter", "cashier", "admin", "branch_manager"]);
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);
  const { addon } = await searchParams;

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
    { data: itemChannels },
    parentRes,
  ] = await Promise.all([
    itemsQ.order("sort_order", { ascending: true }).order("name", { ascending: true }),
    catsQ.order("sort_order", { ascending: true }),
    outletsQ.order("created_at", { ascending: true }),
    channelsQ.order("sort_order", { ascending: true }),
    stockQ,
    supabase.from("menu_item_channels").select("menu_item_id, channel_id, created_at"),
    addon
      ? supabase
          .from("orders")
          .select("id, order_number, outlet_id, table_number, customer_name, order_channel, service_type")
          .eq("id", addon)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const addonOf: AddonContext | null = parentRes.data
    ? {
        id: (parentRes.data as { id: string }).id,
        order_number: (parentRes.data as { order_number: string }).order_number,
        outlet_id: (parentRes.data as { outlet_id: string | null }).outlet_id,
        table_number: (parentRes.data as { table_number: string | null }).table_number,
        customer_name: (parentRes.data as { customer_name: string | null }).customer_name,
        order_channel: (parentRes.data as { order_channel: string | null }).order_channel,
        service_type:
          (parentRes.data as { service_type?: "dine_in" | "takeaway" | null }).service_type ?? "dine_in",
      }
    : null;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title={addonOf ? `Pesanan tambahan · ${addonOf.order_number}` : "Pesanan baru"}
        description={
          addonOf
            ? "Tambahkan item baru; pesanan ini terhubung ke pesanan induk."
            : "Pilih item, tinjau keranjang, dan kirim ke dapur"
        }
      />
      <NewOrderClient
        items={(items ?? []) as MenuItem[]}
        categories={(categories ?? []) as MenuCategory[]}
        outlets={(outlets ?? []) as Pick<Outlet, "id" | "name" | "is_temporary">[]}
        channels={(channels ?? []) as OrderChannelConfig[]}
        dailyStocks={(stocks ?? []) as DailyStock[]}
        menuItemChannels={(itemChannels ?? []) as MenuItemChannel[]}
        addonOf={addonOf}
      />
    </div>
  );
}
