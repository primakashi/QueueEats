import { UtensilsCrossed } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { PublicMenu } from "./public-menu";

export const revalidate = 60;

export const metadata = {
  title: "Menu · QueueEats",
  description: "Browse our menu",
};

export default async function MenuPage() {
  const supabase = await createClient();

  const [{ data: items }, { data: categories }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*")
      .eq("is_available", true)
      .order("name", { ascending: true }),
    supabase
      .from("menu_categories")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  const categoriesTyped = (categories ?? []) as MenuCategory[];
  const itemsTyped = (items ?? []) as MenuItem[];

  return (
    <main className="flex-1 bg-background">
      <header className="border-b bg-gradient-to-b from-muted/40 to-transparent">
        <div className="max-w-5xl mx-auto px-5 py-6 sm:py-12 text-center">
          <div className="inline-flex h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary text-primary-foreground items-center justify-center mb-2.5 sm:mb-4">
            <UtensilsCrossed className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight">
            QueueEats
          </h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Our menu
          </p>
        </div>
      </header>

      <PublicMenu items={itemsTyped} categories={categoriesTyped} />

      <footer className="border-t mt-16">
        <div className="max-w-5xl mx-auto px-5 py-6 text-center text-xs text-muted-foreground">
          Place your order with our waiter at the counter.
        </div>
      </footer>
    </main>
  );
}
