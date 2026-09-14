import { Suspense } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { MenuItemsBoard, MenuBoardSkeleton } from "./menu-items-board";
import { CategoriesManager } from "../categories/categories-manager";

export default async function AdminMenuPage() {
  const profile = await requireRole(["admin", "branch_manager", "cashier", "waiter"]);
  const rid = getRestaurantFilter(profile);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Menu"
        description="Atur katalog, harga, dan ketersediaan menu dari satu tempat."
        actions={
          <Button size="lg" className="shadow-sm" render={<Link href="/admin/menu/new" />}>
            <Plus className="h-4 w-4 mr-2" /> Item baru
          </Button>
        }
      />
      <Suspense fallback={<MenuContentSkeleton />}>
        <MenuContent rid={rid} />
      </Suspense>
    </div>
  );
}

async function MenuContent({ rid }: { rid: string | null }) {
  const supabase = await createClient();
  let itemsQ = supabase.from("menu_items").select("*");
  let catsQ = supabase.from("menu_categories").select("*");
  if (rid) { itemsQ = itemsQ.eq("restaurant_id", rid); catsQ = catsQ.eq("restaurant_id", rid); }

  const [{ data: items }, { data: categories }] = await Promise.all([
    itemsQ.order("sort_order", { ascending: true }).order("name", { ascending: true }),
    catsQ.order("sort_order", { ascending: true }),
  ]);

  const menuItems = (items ?? []) as MenuItem[];
  const cats = (categories ?? []) as MenuCategory[];

  return (
    <div className="space-y-12">
      <MenuItemsBoard items={menuItems} categories={cats} />

      <section className="scroll-mt-6" id="kategori">
        <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Struktur katalog
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Kategori menu</h2>
            <p className="mt-1 text-sm text-muted-foreground">Buat, ubah, dan urutkan kategori yang dilihat pelanggan.</p>
          </div>
          <div className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            {cats.length} kategori aktif
          </div>
        </div>
        <Card className="max-w-4xl overflow-hidden border-border/70 p-4 shadow-sm sm:p-6">
          <CategoriesManager categories={cats} />
        </Card>
      </section>
    </div>
  );
}

function MenuContentSkeleton() {
  return (
    <div className="space-y-10">
      <MenuBoardSkeleton />
      <div>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-60" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
        <Card className="p-5 max-w-3xl space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </Card>
      </div>
    </div>
  );
}
