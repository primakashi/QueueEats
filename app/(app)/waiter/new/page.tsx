import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { NewOrderClient } from "./new-order-client";

export default async function NewOrderPage() {
  await requireRole(["waiter", "admin"]);
  const supabase = await createClient();

  const [{ data: items }, { data: categories }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*")
      .eq("is_available", true)
      .order("name"),
    supabase
      .from("menu_categories")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="New order"
        description="Pick items, review cart, and send to kitchen"
      />
      <NewOrderClient
        items={(items ?? []) as MenuItem[]}
        categories={(categories ?? []) as MenuCategory[]}
      />
    </div>
  );
}
