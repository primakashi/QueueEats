import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { MenuItemsBoard } from "@/app/(app)/admin/menu/menu-items-board";

const categories: MenuCategory[] = [
  { id: "cat-drinks", name: "Minuman", sort_order: 0, created_at: "2026-08-19T00:00:00.000Z" },
  { id: "cat-food", name: "Makanan", sort_order: 1, created_at: "2026-08-19T00:00:00.000Z" },
  { id: "cat-pempek", name: "Satuan", sort_order: 2, created_at: "2026-08-19T00:00:00.000Z" },
];

const itemDefaults = {
  cost_price: null,
  default_daily_quota: null,
  low_stock_threshold: 5,
  commission_rate: null,
  created_at: "2026-08-19T00:00:00.000Z",
  updated_at: "2026-08-19T00:00:00.000Z",
};

const items: MenuItem[] = [
  { ...itemDefaults, id: "drink-1", category_id: "cat-drinks", name: "Es Teh Manis", description: "Teh melati dingin dengan gula asli", price: 5000, image_url: "/landing/es-kacang-merah.webp", is_available: true, sort_order: 0 },
  { ...itemDefaults, id: "drink-2", category_id: "cat-drinks", name: "Air Mineral", description: null, price: 5000, image_url: null, is_available: true, sort_order: 1 },
  { ...itemDefaults, id: "food-1", category_id: "cat-food", name: "Paket Hemat", description: "Pempek pilihan, mie, dan es teh", price: 30000, image_url: "/landing/pempek.webp", is_available: true, sort_order: 0 },
  { ...itemDefaults, id: "food-2", category_id: "cat-food", name: "Paket Kenyang Keluarga dengan Nama Menu Sangat Panjang", description: "Porsi lengkap untuk dua orang dengan pilihan kuah cuko pedas atau sedang", price: 50000, image_url: "/landing/pempek.webp", is_available: false, sort_order: 1 },
  { ...itemDefaults, id: "pempek-1", category_id: "cat-pempek", name: "Pempek Adaan", description: "Gurih, lembut, dan dibuat segar setiap hari", price: 5000, image_url: "/landing/pempek.webp", is_available: true, sort_order: 0 },
  { ...itemDefaults, id: "pempek-2", category_id: "cat-pempek", name: "Pempek Kulit", description: "Tekstur renyah dengan rasa ikan yang kuat", price: 5000, image_url: "/landing/pempek.webp", is_available: false, sort_order: 1 },
  { ...itemDefaults, id: "pempek-3", category_id: "cat-pempek", name: "Pempek Kapal Selam", description: "Pempek besar dengan isian telur utuh", price: 15000, image_url: "/landing/pempek.webp", is_available: true, sort_order: 2 },
  { ...itemDefaults, id: "pempek-4", category_id: null, name: "Menu Belum Dikategorikan", description: "Contoh item yang masih perlu dirapikan", price: 12000, image_url: null, is_available: true, sort_order: 0 },
];

export default function MenuPreviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.DEV_UI_PLAYGROUND !== "true") notFound();

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-50 p-4 text-amber-950">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Preview lokal — data sintetis</p>
            <p className="mt-0.5 text-xs text-amber-900/75">Gunakan pencarian dan filter untuk pengujian UI. Tombol simpan, ubah, ketersediaan, dan hapus memerlukan sesi staging.</p>
          </div>
        </div>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
            <p className="mt-1 text-sm text-muted-foreground">Atur katalog, harga, dan ketersediaan menu dari satu tempat.</p>
          </div>
          <div className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">+ Item baru</div>
        </header>
        <MenuItemsBoard items={items} categories={categories} />
        <div id="kategori" className="h-24 rounded-2xl border border-dashed bg-card p-5">
          <p className="font-semibold">Kategori menu</p>
          <p className="mt-1 text-sm text-muted-foreground">Area pengelolaan kategori dilanjutkan di halaman menu terautentikasi.</p>
        </div>
      </div>
    </main>
  );
}
