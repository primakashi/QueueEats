import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "pg";
const { Client } = pkg;

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
loadEnv({ path: resolve(ROOT, ".env.local") });

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !password) {
  console.error(
    "Set SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD (url-encoded) in .env.local",
  );
  process.exit(1);
}

const regions = [
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-south-1",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "eu-central-1",
  "eu-west-1",
];

const hosts = [];
for (const r of regions) {
  hosts.push(`aws-0-${r}.pooler.supabase.com`);
  hosts.push(`aws-1-${r}.pooler.supabase.com`);
}

for (const host of hosts) {
  const url = `postgresql://postgres.${ref}:${password}@${host}:5432/postgres`;
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000,
  });
  process.stdout.write(`${host.padEnd(48)} `);
  try {
    await client.connect();
    const res = await client.query("select current_database(), current_user");
    console.log("OK", res.rows[0]);
    console.log(`\n\nWorking connection string:\n${url}\n`);
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log("FAIL", (e.message?.split("\n")[0] ?? "" + e).slice(0, 60));
    try {
      await client.end();
    } catch {}
  }
}
process.exit(1);
