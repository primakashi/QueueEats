import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type { MenuCategory, MenuItem, OrderChannelConfig } from "@/lib/types";
import { MenuItemForm } from "../../menu-item-form";
import { MenuItemFormSkeleton } from "../../menu-item-form-skeleton";

type Props = { params: Promise<{ id: string }> };

export default async function EditMenuItemPage({ params }: Props) {
  await requireRole(["admin"]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Ubah item menu" />
      <Suspense fallback={<MenuItemFormSkeleton />}>
        <EditFormLoader params={params} />
      </Suspense>
    </div>
  );
}

async function EditFormLoader({ params }: Props) {
  const { id } = await params;
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);

  let catsQ = supabase.from("menu_categories").select("*");
  let chQ = supabase
    .from("order_channels")
    .select("id, name, sort_order, is_active, kind, commission_rate")
    .eq("is_active", true);
  let allItemsQ = supabase
    .from("menu_items")
    .select("id, name, sort_order, category_id")
    .order("sort_order", { ascending: true });
  if (rid) {
    catsQ = catsQ.eq("restaurant_id", rid);
    chQ = chQ.eq("restaurant_id", rid);
    allItemsQ = allItemsQ.eq("restaurant_id", rid);
  }

  const [{ data: itemRaw }, { data: categories }, { data: channels }, { data: assignments }, { data: allItemsRaw }] =
    await Promise.all([
      supabase.from("menu_items").select("*").eq("id", id).maybeSingle(),
      catsQ.order("sort_order", { ascending: true }),
      chQ.order("sort_order", { ascending: true }),
      supabase.from("menu_item_channels").select("channel_id").eq("menu_item_id", id),
      allItemsQ,
    ]);

  if (!itemRaw) notFound();
  const item = itemRaw as MenuItem;

  const siblingItems = (allItemsRaw ?? []).filter(
    (i) => i.category_id === item.category_id,
  ) as Array<{ id: string; name: string; sort_order: number }>;

  return (
    <MenuItemForm
      categories={(categories ?? []) as MenuCategory[]}
      channels={(channels ?? []) as OrderChannelConfig[]}
      assignedChannelIds={((assignments ?? []) as Array<{ channel_id: string }>).map((a) => a.channel_id)}
      item={item}
      siblingItems={siblingItems}
    />
  );
}
