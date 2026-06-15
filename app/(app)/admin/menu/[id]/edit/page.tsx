import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type { MenuCategory, MenuItem } from "@/lib/types";
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
  if (rid) catsQ = catsQ.eq("restaurant_id", rid);

  const [{ data: item }, { data: categories }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("id", id).maybeSingle(),
    catsQ.order("sort_order", { ascending: true }),
  ]);

  if (!item) notFound();

  return (
    <MenuItemForm
      categories={(categories ?? []) as MenuCategory[]}
      item={item as MenuItem}
    />
  );
}
