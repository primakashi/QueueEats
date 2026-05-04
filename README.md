# QueueEats POS

A web-based Point of Sale system with role-based workflows for restaurants:

- **Waiter** — takes orders on a tablet, items flow straight to the kitchen
- **Kitchen** — realtime queue of pending and in-progress orders
- **Cashier** — completes payment via QRIS (Xendit) or cash
- **Admin** — manages menu items, categories, and staff roles

Built with Next.js 16 (App Router), Supabase (Postgres, Auth, Realtime, Storage), Tailwind CSS, shadcn/ui, and the Xendit QR Codes API.

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. Copy your project URL, `anon` key, and `service_role` key into `.env.local` (see `.env.local.example`).

### 3. Apply the schema

Open **Supabase Studio → SQL Editor** and run the contents of:

- `supabase/migrations/0001_init.sql` — creates tables, enums, RLS policies, triggers, and realtime publication.
- `supabase/seed.sql` (optional) — adds sample categories and menu items.

You can also run these via the Supabase CLI (`supabase db push`) if you prefer.

### 4. Create your first staff user

- **Supabase Studio → Authentication → Add user** — create an email/password account.
- **SQL Editor** — promote this user to admin:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

Once an admin exists, they can change other users' roles from the **Staff** page inside the app. New users sign up through Supabase and default to the `waiter` role.

### 5. Set up Xendit

1. Create a [Xendit](https://www.xendit.co) account and grab your secret key (`xnd_development_xxx` in test mode).
2. In the Xendit dashboard, set the **QR Payment** callback URL to:

   ```
   https://<your-domain>/api/xendit/webhook
   ```

3. Set the **Callback Token** (Xendit calls this the verification token) to any random string, and put the same string in `XENDIT_CALLBACK_TOKEN`.
4. In development, expose your localhost to Xendit with a tunnel (e.g. `ngrok http 3000`).

### 6. Run the app

```bash
cp .env.local.example .env.local
# fill in your values
npm run dev
```

Open http://localhost:3000 and sign in.

## Architecture

```
┌──────────┐   insert   ┌──────────────┐
│ Waiter   │──────────▶ │              │
└──────────┘            │              │
                        │   Supabase   │
┌──────────┐  realtime  │   (Postgres  │
│ Kitchen  │◀───────────│    + Auth    │
└──────────┘            │    + Realtime│
                        │              │
┌──────────┐ create QR  └──────┬───────┘
│ Cashier  │───────┐           │
└──────────┘       │           │ webhook
                   ▼           ▼
                ┌────────────────┐
                │    Xendit      │
                └────────────────┘
```

- **Orders are created** through the `create_order` Postgres RPC (security definer). It atomically inserts into `orders` + `order_items` and generates a human-readable `order_number` (`ORD-YYYYMMDD-NNNN`) from a daily counter.
- **Kitchen subscribes** to `postgres_changes` on `orders` + `order_items` and re-renders when orders arrive or change status.
- **Payments** are created through the Xendit QR Codes API. The QR string is rendered client-side with `qrcode.react`. The payment page subscribes to its `payments` row for live status updates.
- **The webhook** at `/api/xendit/webhook` verifies the `x-callback-token` header, looks up the payment by `xendit_qr_id`, and updates `payments` + `orders` atomically.

## File layout

```
app/
  (auth-like)/login/           # public login page + Server Actions
  (app)/
    layout.tsx                 # shared shell, auth guard
    waiter/                    # order list + new order + confirmation
    kitchen/                   # realtime queue
    cashier/                   # payment list + [orderId] payment screen
    admin/                     # menu CRUD, categories, staff roles
  api/xendit/webhook/          # Xendit callback
lib/
  supabase/                    # server, client, admin, middleware clients
  xendit.ts                    # Xendit QR Codes API wrapper
  auth.ts, types.ts, format.ts, status.ts
supabase/
  migrations/0001_init.sql
  seed.sql
components/
  ui/                          # shadcn primitives
  app-shell.tsx                # role-aware sidebar
```

## Deploying

1. Push to GitHub and import into [Vercel](https://vercel.com).
2. Add the same env vars from `.env.local.example` to the Vercel project.
3. Set `NEXT_PUBLIC_APP_URL` to your production URL.
4. Update the Xendit callback URL to `https://<your-domain>/api/xendit/webhook`.

## Out of scope (on purpose)

- Multi-outlet / multi-tenant
- Receipt printing (can add via ESC/POS or browser print)
- Inventory, discounts, taxes
- Analytics / reporting dashboards

These can be added incrementally without restructuring the schema.
