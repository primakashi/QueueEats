import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { MenuCategory } from "@/lib/types";
import { MenuItemForm } from "../menu-item-form";

export default async function NewMenuItemPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("menu_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  const categories = (data ?? []) as MenuCategory[];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="New menu item" description="Add a new item to the menu" />
      <MenuItemForm categories={categories} />
    </div>
  );
}
