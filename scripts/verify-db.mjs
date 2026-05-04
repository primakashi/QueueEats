import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "pg";
const { Client } = pkg;

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
loadEnv({ path: resolve(ROOT, ".env.local") });

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const tables = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `);
  console.log("public tables:");
  tables.rows.forEach((r) => console.log(" -", r.table_name));

  const cats = await client.query(
    "select count(*)::int as n from public.menu_categories",
  );
  const items = await client.query(
    "select count(*)::int as n from public.menu_items",
  );
  const profiles = await client.query(
    "select count(*)::int as n from public.profiles",
  );
  const users = await client.query("select count(*)::int as n from auth.users");
  console.log("\ncounts:");
  console.log("  menu_categories:", cats.rows[0].n);
  console.log("  menu_items     :", items.rows[0].n);
  console.log("  profiles       :", profiles.rows[0].n);
  console.log("  auth.users     :", users.rows[0].n);
} finally {
  await client.end();
}
