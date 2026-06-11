import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { MenuCategory, MenuItem, OrderChannelConfig, Outlet } from "@/lib/types";
import { NewOrderClient } from "./new-order-client";

export default async function NewOrderPage() {
  await requireRole(["waiter", "admin"]);
  const supabase = await createClient();

  const [{ data: items }, { data: categories }, { data: outlets }, { data: channels }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*")
      .eq("is_available", true)
      .order("name"),
    supabase
      .from("menu_categories")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("outlets")
      .select("id, name, is_temporary")
      .eq("is_archived", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_channels")
      .select("id, name, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
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
      />
    </div>
  );
}
