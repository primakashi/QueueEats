import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { AvailabilityToggle } from "./availability-toggle";
import { DeleteMenuItemButton } from "./delete-button";
import { CategoriesManager } from "../categories/categories-manager";

export default async function AdminMenuPage() {
  const profile = await requireRole(["admin", "branch_manager", "cashier", "waiter"]);
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);

  let itemsQ = supabase.from("menu_items").select("*");
  let catsQ = supabase.from("menu_categories").select("*");
  if (rid) { itemsQ = itemsQ.eq("restaurant_id", rid); catsQ = catsQ.eq("restaurant_id", rid); }

  const [{ data: items }, { data: categories }] = await Promise.all([
    itemsQ
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    catsQ.order("sort_order", { ascending: true }),
  ]);

  const categoryMap = new Map<string, MenuCategory>();
  (categories ?? []).forEach((c) => categoryMap.set(c.id, c as MenuCategory));

  const menuItems = (items ?? []) as MenuItem[];
  const cats = (categories ?? []) as MenuCategory[];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      <div>
        <PageHeader
          title="Menu"
          description="Buat, ubah, dan kelola item menu"
          actions={
            <Button render={<Link href="/admin/menu/new" />}>
              <Plus className="h-4 w-4 mr-2" /> Item baru
            </Button>
          }
        />

        {menuItems.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {menuItems.map((item) => (
              <Card key={item.id} className="overflow-hidden gap-0 pt-0 pb-4">
                <div className="relative aspect-video bg-muted">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                      Tanpa gambar
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <AvailabilityToggle id={item.id} available={item.is_available} />
                  </div>
                </div>
                <div className="px-4 pt-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.category_id
                          ? (categoryMap.get(item.category_id)?.name ?? "Tanpa kategori")
                          : "Tanpa kategori"}
                      </div>
                    </div>
                    <Badge variant="secondary">{formatIDR(item.price)}</Badge>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      render={<Link href={`/admin/menu/${item.id}/edit`} />}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Ubah
                    </Button>
                    <DeleteMenuItemButton id={item.id} name={item.name} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-4">
          <h2 className="text-base font-semibold">Kategori</h2>
          <p className="text-sm text-muted-foreground">Kelola kategori item menu</p>
        </div>
        <div className="max-w-lg">
          <CategoriesManager categories={cats} />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="p-12 text-center">
      <h2 className="text-lg font-medium mb-2">Belum ada item menu</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Tambahkan item pertama untuk memulai.
      </p>
      <Button render={<Link href="/admin/menu/new" />}>
        <Plus className="h-4 w-4 mr-2" /> Item baru
      </Button>
    </Card>
  );
}
