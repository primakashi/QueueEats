// Applies every SQL file under supabase/migrations/ (in lexical order)
// and optionally supabase/seed.sql when --seed is passed.
//
//   node scripts/apply-migrations.mjs
//   node scripts/apply-migrations.mjs --seed
//
// Reads the database URL from SUPABASE_DB_URL in .env.local.

import { config as loadEnv } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "pg";
const { Client } = pkg;

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const MIGRATIONS_DIR = resolve(ROOT, "supabase/migrations");
const SEED_FILE = resolve(ROOT, "supabase/seed.sql");

loadEnv({ path: resolve(ROOT, ".env.local") });

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("Missing SUPABASE_DB_URL in .env.local");
    process.exit(1);
  }

  const runSeed = process.argv.includes("--seed");

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(`
      create schema if not exists _qe;
      create table if not exists _qe.migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const applied = new Set(
      (await client.query("select filename from _qe.migrations")).rows.map(
        (r) => r.filename,
      ),
    );

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`✓ ${file} (already applied)`);
        continue;
      }
      const full = resolve(MIGRATIONS_DIR, file);
      const sql = await readFile(full, "utf8");
      console.log(`→ Applying ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into _qe.migrations(filename) values ($1)",
          [file],
        );
        await client.query("commit");
        console.log(`  ok (${sql.length} chars)`);
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }

    if (runSeed) {
      const sql = await readFile(SEED_FILE, "utf8");
      console.log("→ Applying seed.sql");
      await client.query(sql);
      console.log("  ok");
    }

    console.log("Done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
