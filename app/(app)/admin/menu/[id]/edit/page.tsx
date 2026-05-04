import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { MenuItemForm } from "../../menu-item-form";

type Props = { params: Promise<{ id: string }> };

export default async function EditMenuItemPage({ params }: Props) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: item }, { data: categories }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("menu_categories")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  if (!item) notFound();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Edit menu item" description={(item as MenuItem).name} />
      <MenuItemForm
        categories={(categories ?? []) as MenuCategory[]}
        item={item as MenuItem}
      />
    </div>
  );
}
