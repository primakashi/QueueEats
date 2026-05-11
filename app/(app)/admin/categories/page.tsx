import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { MenuCategory } from "@/lib/types";
import { CategoriesManager } from "./categories-manager";

export default async function CategoriesPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("menu_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title="Kategori"
        description="Kelompokkan item menu ke dalam kategori"
      />
      <Card className="p-5">
        <CategoriesManager categories={(data ?? []) as MenuCategory[]} />
      </Card>
    </div>
  );
}
