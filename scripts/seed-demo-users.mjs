// Idempotently seed four demo staff accounts — one per role.
// Emails:   admin@google.com, waiter@google.com, kitchen@google.com, cashier@google.com
// Password: Passw0rd
//
//   node scripts/seed-demo-users.mjs
//
// Safe to run multiple times — upserts auth.users, auth.identities, public.profiles.

import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "pg";
const { Client } = pkg;

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
loadEnv({ path: resolve(ROOT, ".env.local") });

const PASSWORD = "Passw0rd";
const USERS = [
  { email: "admin@google.com",   role: "admin",   fullName: "Demo Admin"   },
  { email: "waiter@google.com",  role: "waiter",  fullName: "Demo Waiter"  },
  { email: "kitchen@google.com", role: "kitchen", fullName: "Demo Kitchen" },
  { email: "cashier@google.com", role: "cashier", fullName: "Demo Cashier" },
];

async function upsertUser(client, { email, fullName, role }) {
  const existing = await client.query(
    "select id from auth.users where email = $1",
    [email],
  );
  let userId;

  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
    await client.query(
      `update auth.users
         set encrypted_password = crypt($1, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             raw_user_meta_data = jsonb_build_object('full_name', $2::text, 'role', $3::text),
             updated_at = now()
       where id = $4`,
      [PASSWORD, fullName, role, userId],
    );
  } else {
    const ins = await client.query(
      `insert into auth.users (
         instance_id, id, aud, role, email,
         encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data,
         created_at, updated_at,
         confirmation_token, email_change, email_change_token_new, recovery_token
       ) values (
         '00000000-0000-0000-0000-000000000000',
         gen_random_uuid(),
         'authenticated',
         'authenticated',
         $1,
         crypt($2, gen_salt('bf')),
         now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('full_name', $3::text, 'role', $4::text),
         now(),
         now(),
         '', '', '', ''
       )
       returning id`,
      [email, PASSWORD, fullName, role],
    );
    userId = ins.rows[0].id;

    const identityData = JSON.stringify({
      sub: userId,
      email,
      email_verified: true,
    });
    await client.query(
      `insert into auth.identities (
         id, provider_id, user_id, identity_data, provider,
         last_sign_in_at, created_at, updated_at
       ) values (
         gen_random_uuid(),
         $1,
         $2::uuid,
         $3::jsonb,
         'email',
         now(), now(), now()
       )
       on conflict do nothing`,
      [email, userId, identityData],
    );
  }

  await client.query(
    `insert into public.profiles (id, full_name, role)
     values ($1, $2, $3)
     on conflict (id) do update
       set full_name = excluded.full_name,
           role = excluded.role`,
    [userId, fullName, role],
  );
  return userId;
}

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("begin");
    for (const u of USERS) {
      const id = await upsertUser(client, u);
      console.log(`  ok  ${u.role.padEnd(8)} ${u.email.padEnd(22)} ${id}`);
    }
    await client.query("commit");
    console.log(`\nPassword for all demo accounts: ${PASSWORD}`);
  } catch (e) {
    await client.query("rollback");
    console.error("failed:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
