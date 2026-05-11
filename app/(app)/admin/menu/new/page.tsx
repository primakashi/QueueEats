import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { MenuCategory } from "@/lib/types";
import { MenuItemForm } from "../menu-item-form";
import { MenuItemFormSkeleton } from "../menu-item-form-skeleton";

export default async function NewMenuItemPage() {
  await requireRole(["admin"]);

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
  const supabase = await createClient();
  const { data } = await supabase
    .from("menu_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  const categories = (data ?? []) as MenuCategory[];
  return <MenuItemForm categories={categories} />;
}
