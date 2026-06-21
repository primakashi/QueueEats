/**
 * Seed menu for restaurant d3243bc5-5ac9-4288-835c-84d69af041c0
 * Run: npx tsx scripts/seed-menu.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const RESTAURANT_ID = "d3243bc5-5ac9-4288-835c-84d69af041c0";

type ItemSeed = { name: string; description?: string; price: number };

const UMUM: ItemSeed[] = [
  { name: "Nasi Mandhi Ayam", description: "Nasi mandhi + 1 potong ayam bagian dada/paha + sambal", price: 49000 },
  { name: "Nasi Mandhi Iga Sapi", description: "Nasi mandhi + 1 porsi iga sapi + sambal", price: 85000 },
  { name: "Nasi Mandhi Kambing", description: "Nasi mandhi + 1 porsi kambing + sambal + acar", price: 99000 },
  { name: "Rice Bowl Ayam", description: "Nasi mandhi + ayam suir + sambal", price: 38000 },
  { name: "Rice Bowl Iga Sapi", description: "Nasi mandhi + iga sapi suir + sambal", price: 55000 },
  { name: "Rice Bowl Kambing", description: "Nasi mandhi + kambing suir + sambal + Acar", price: 68000 },
  { name: "Loyang Mini - Daging Ayam", description: "Nasi mandhi + lauk + sambal + acar (untuk 3 porsi)", price: 168000 },
  { name: "Loyang Mini - Daging Kambing", description: "Nasi mandhi + lauk + sambal + acar (untuk 3 porsi)", price: 335000 },
  { name: "Loyang Mini - Daging Iga Sapi", description: "Nasi mandhi + lauk + sambal + acar (untuk 3 porsi)", price: 310000 },
  { name: "Loyang Sedang - Daging Ayam", description: "Nasi mandhi + lauk + sambal + acar (untuk 5 porsi)", price: 248000 },
  { name: "Loyang Sedang - Daging Kambing", description: "Nasi mandhi + lauk + sambal + acar (untuk 5 porsi)", price: 485000 },
  { name: "Loyang Sedang - Daging Iga Sapi", description: "Nasi mandhi + lauk + sambal + acar (untuk 5 porsi)", price: 385000 },
  { name: "Loyang Besar - Daging Ayam", description: "Nasi mandhi + lauk + sambal + acar (untuk 10 porsi)", price: 450000 },
  { name: "Loyang Besar - Daging Kambing", description: "Nasi mandhi + lauk + sambal + acar (untuk 10 porsi)", price: 968000 },
  { name: "Loyang Besar - Daging Iga Sapi", description: "Nasi mandhi + lauk + sambal + acar (untuk 10 porsi)", price: 789000 },
  { name: "Loyang Mini Mix 1", description: "2 Ayam 1 Kambing/Iga Sapi", price: 260000 },
  { name: "Loyang Mini Mix 2", description: "1 Ayam 2 Kambing/Iga Sapi", price: 325000 },
  { name: "Loyang Sedang Mix 1", description: "3 Ayam 2 Kambing/Iga Sapi", price: 360000 },
  { name: "Loyang Sedang Mix 2", description: "2 Ayam 3 Kambing/Iga Sapi", price: 400000 },
  { name: "Loyang Sedang Mix 3", description: "3 Ayam 3 Kambing/Iga Sapi", price: 460000 },
  { name: "Loyang Besar Mix", description: "5 Ayam 5 Kambing/Iga Sapi", price: 750000 },
  { name: "Nasi Mandhi Saja", price: 28000 },
  { name: "Ayam Panggang Per Potong", price: 30000 },
  { name: "Ayam Panggang Utuh Per Ekor", price: 125000 },
  { name: "Kambing Panggang Per Potong", price: 75000 },
  { name: "Iga Panggang Per Potong", price: 60000 },
  { name: "Sambal Kecil", price: 8000 },
  { name: "Sambal Besar", price: 15000 },
  { name: "Acar Nanas Kecil", price: 8000 },
  { name: "Acar Nanas Besar", price: 15000 },
];

const MINUMAN: ItemSeed[] = [
  { name: "Susu Kurma", price: 10000 },
  { name: "Nipis Madu", price: 10000 },
  { name: "Pocari Sweat", price: 10000 },
  { name: "Nutriboost", price: 12000 },
  { name: "Air Mineral 330ml", price: 5000 },
  { name: "Air Mineral 600ml", price: 10000 },
];

const ONLINE: ItemSeed[] = [
  // Food items — same descriptions as Umum, online prices
  { name: "Nasi Mandhi Ayam", description: "Nasi mandhi + 1 potong ayam bagian dada/paha + sambal", price: 62000 },
  { name: "Nasi Mandhi Iga Sapi", description: "Nasi mandhi + 1 porsi iga sapi + sambal", price: 107000 },
  { name: "Nasi Mandhi Kambing", description: "Nasi mandhi + 1 porsi kambing + sambal + acar", price: 125000 },
  { name: "Rice Bowl Ayam", description: "Nasi mandhi + ayam suir + sambal", price: 48000 },
  { name: "Rice Bowl Iga Sapi", description: "Nasi mandhi + iga sapi suir + sambal", price: 69000 },
  { name: "Rice Bowl Kambing", description: "Nasi mandhi + kambing suir + sambal + Acar", price: 85000 },
  { name: "Loyang Mini - Daging Ayam", description: "Nasi mandhi + lauk + sambal + acar (untuk 3 porsi)", price: 210000 },
  { name: "Loyang Mini - Daging Kambing", description: "Nasi mandhi + lauk + sambal + acar (untuk 3 porsi)", price: 419000 },
  { name: "Loyang Mini - Daging Iga Sapi", description: "Nasi mandhi + lauk + sambal + acar (untuk 3 porsi)", price: 396000 },
  { name: "Loyang Sedang - Daging Ayam", description: "Nasi mandhi + lauk + sambal + acar (untuk 5 porsi)", price: 310000 },
  { name: "Loyang Sedang - Daging Kambing", description: "Nasi mandhi + lauk + sambal + acar (untuk 5 porsi)", price: 607000 },
  { name: "Loyang Sedang - Daging Iga Sapi", description: "Nasi mandhi + lauk + sambal + acar (untuk 5 porsi)", price: 582000 },
  { name: "Loyang Besar - Daging Ayam", description: "Nasi mandhi + lauk + sambal + acar (untuk 10 porsi)", price: 563000 },
  { name: "Loyang Besar - Daging Kambing", description: "Nasi mandhi + lauk + sambal + acar (untuk 10 porsi)", price: 1210000 },
  { name: "Loyang Besar - Daging Iga Sapi", description: "Nasi mandhi + lauk + sambal + acar (untuk 10 porsi)", price: 986000 }, // +25%
  { name: "Loyang Mini Mix 1", description: "2 Ayam 1 Kambing/Iga Sapi", price: 340000 },
  { name: "Loyang Mini Mix 2", description: "1 Ayam 2 Kambing/Iga Sapi", price: 407000 },
  { name: "Loyang Sedang Mix 1", description: "3 Ayam 2 Kambing/Iga Sapi", price: 450000 },
  { name: "Loyang Sedang Mix 2", description: "2 Ayam 3 Kambing/Iga Sapi", price: 500000 },
  { name: "Loyang Sedang Mix 3", description: "3 Ayam 3 Kambing/Iga Sapi", price: 575000 },
  { name: "Loyang Besar Mix", description: "5 Ayam 5 Kambing/Iga Sapi", price: 938000 },
  { name: "Nasi Mandhi Saja", price: 35000 },
  { name: "Ayam Panggang Per Potong", price: 38000 },
  { name: "Ayam Panggang Utuh Per Ekor", price: 156000 }, // +25%
  { name: "Kambing Panggang Per Potong", price: 95000 },
  { name: "Iga Panggang Per Potong", price: 75000 },
  { name: "Sambal Kecil", price: 6000 },
  { name: "Sambal Besar", price: 20000 },
  { name: "Acar Nanas Kecil", price: 6000 },
  { name: "Acar Nanas Besar", price: 20000 },
  // Drinks — online-specific names & prices
  { name: "Nipis Madu 330ml", price: 13000 },
  { name: "Nutri Boost Susu", price: 15000 },
  { name: "Pocari Sweat", price: 15000 },
  { name: "Le Mineral 330ml", price: 6000 },
  { name: "Le Mineral 600ml", price: 10000 },
  { name: "Es Tea Manis", price: 12000 },
  { name: "Floridina Orange", price: 10000 },
  { name: "Floridina Orange Coco 350ml", price: 13000 },
  { name: "Good Day", price: 10000 },
  { name: "Sprite 390ml", price: 7000 },
  // Extra condiments online-only
  { name: "Sambel Kurma Kecil", price: 15000 },
  { name: "Sambel Pecak Kecil", price: 15000 },
];

async function upsertCategory(name: string, sortOrder: number): Promise<string> {
  const { data: existing } = await supabase
    .from("menu_categories")
    .select("id")
    .eq("restaurant_id", RESTAURANT_ID)
    .eq("name", name)
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Category exists: ${name} (${existing.id})`);
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("menu_categories")
    .insert({ name, sort_order: sortOrder, restaurant_id: RESTAURANT_ID })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to create category "${name}": ${error?.message}`);
  console.log(`  Created category: ${name} (${data.id})`);
  return data.id as string;
}

async function insertItems(items: ItemSeed[], categoryId: string): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const { error } = await supabase.from("menu_items").insert({
      name: item.name,
      description: item.description ?? null,
      price: item.price,
      category_id: categoryId,
      restaurant_id: RESTAURANT_ID,
      sort_order: i,
      is_available: true,
    });
    if (error) {
      console.error(`  ERROR inserting "${item.name}": ${error.message}`);
    } else {
      console.log(`  + ${item.name} — Rp ${item.price.toLocaleString("id-ID")}`);
    }
  }
}

async function main() {
  console.log("Seeding menu for restaurant:", RESTAURANT_ID);

  console.log("\n[1/3] Category: Umum");
  const umumId = await upsertCategory("Umum", 0);
  await insertItems(UMUM, umumId);

  console.log("\n[2/3] Category: Minuman");
  const minumanId = await upsertCategory("Minuman", 1);
  await insertItems(MINUMAN, minumanId);

  console.log("\n[3/3] Category: Online");
  const onlineId = await upsertCategory("Online", 2);
  await insertItems(ONLINE, onlineId);

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
