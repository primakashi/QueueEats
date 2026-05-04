// One-off: attach curated Unsplash photos to seed menu items.
// Idempotent — only updates rows whose name matches exactly.
//
//   node scripts/update-menu-images.mjs
//
// Uses SUPABASE_DB_URL from .env.local.

import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "pg";
const { Client } = pkg;

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
loadEnv({ path: resolve(ROOT, ".env.local") });

// Direct Unsplash CDN URLs (verified on unsplash.com).
// All are free-to-use under the Unsplash License.
const PARAMS = "w=1200&q=80&auto=format&fit=crop";
const IMAGES = {
  "Nasi Goreng Special":
    `https://images.unsplash.com/photo-1680674814945-7945d913319c?${PARAMS}`,
  "Ayam Bakar":
    `https://images.unsplash.com/photo-1763219802762-1d34ee0907c5?${PARAMS}`,
  "Mie Goreng":
    `https://images.unsplash.com/photo-1680675494363-75bbf9838a09?${PARAMS}`,
  "Tempe Goreng":
    `https://images.unsplash.com/photo-1698309377471-54a87740d979?${PARAMS}`,
  "Kerupuk":
    `https://images.unsplash.com/photo-1633466665191-8e4a0c1d35da?${PARAMS}`,
  "Es Teh Manis":
    `https://images.unsplash.com/photo-1777259277658-8b89aec4f004?${PARAMS}`,
  "Jus Alpukat":
    `https://images.unsplash.com/photo-1768723228817-7902ab347f5d?${PARAMS}`,
  "Pisang Goreng":
    `https://images.unsplash.com/photo-1762941904142-9d91ca413e66?${PARAMS}`,
};

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("Missing SUPABASE_DB_URL in .env.local");
    process.exit(1);
  }
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let updated = 0;
  let missing = 0;
  for (const [name, imageUrl] of Object.entries(IMAGES)) {
    const res = await client.query(
      "update public.menu_items set image_url = $1, updated_at = now() where name = $2 returning id",
      [imageUrl, name],
    );
    if (res.rowCount > 0) {
      updated += res.rowCount;
      console.log(`  ok  ${name}`);
    } else {
      missing += 1;
      console.log(`  -   ${name} (no matching row)`);
    }
  }

  await client.end();
  console.log(`\nUpdated ${updated} rows. ${missing} names had no match.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
