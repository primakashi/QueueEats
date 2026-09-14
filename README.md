# Ayam Seruni POS

A web-based restaurant management suite with role-based workflows:

- **Waiter** — takes orders on a tablet; items flow straight to the kitchen
- **Kitchen** — realtime queue of pending and in-progress orders
- **Cashier** — completes payment via QRIS (Xendit) or cash
- **Host** — manages the floor plan and seats waiting customers from the queue
- **Admin** — manages menu items, categories, staff roles, and views the sales dashboard

Public-facing pages (no login required):
- `/menu` — browse the full menu
- `/queue` — live queue board displayed at the entrance
- `/queue/join` — customers join the queue from their phone and receive a WhatsApp link with their position
- `/queue/[token]` — personal queue status page for each customer
- `/pay/[paymentId]` — payment screen served to the customer's phone

Built with Next.js 16 (App Router), Supabase (Postgres, Auth, Realtime, Storage), Tailwind CSS v4, shadcn/ui, Recharts, and the Xendit QR Codes API.

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. Copy your project URL, `anon` key, and `service_role` key into `.env.local` (see `.env.local.example`).

### 3. Apply the schema

Open **Supabase Studio → SQL Editor** and run the migrations in order:

- `supabase/migrations/0001_init.sql` — tables, enums, RLS policies, triggers, realtime publication
- `supabase/migrations/0002_public_menu.sql` — public menu RLS policy
- `supabase/migrations/0003_mock_payment.sql` — mock payment helper
- `supabase/migrations/0004_queue_entries.sql` — queue management tables
- `supabase/seed.sql` (optional) — sample categories and menu items

You can also run these via the Supabase CLI (`supabase db push`).

### 4. Create your first staff user

- **Supabase Studio → Authentication → Add user** — create an email/password account.
- **SQL Editor** — promote this user to admin:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

Once an admin exists, they can change other users' roles from the **Staff** page inside the app. New users default to the `waiter` role.

### 5. Set up Xendit

1. Create a [Xendit](https://www.xendit.co) account and grab your secret key (`xnd_development_xxx` in test mode).
2. In the Xendit dashboard, set the **QR Payment** callback URL to:

   ```
   https://<your-domain>/api/xendit/webhook
   ```

3. Set the **Callback Token** to any random string and put the same value in `XENDIT_CALLBACK_TOKEN`.
4. In development, expose your localhost with a tunnel (e.g. `ngrok http 3000`).

### 6. Run the app

```bash
cp .env.local.example .env.local
# fill in your values
npm run dev
```

Open http://localhost:3000 and sign in.

## Product documentation

- [Roles, flows, current UI, and UI/UX revamp recommendations](docs/product-flows-and-ux-revamp.md)

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
┌──────────┐            └──────┬───────┘
│ Host     │◀─── realtime      │
└──────────┘  (queue entries)  │ webhook
                               │
┌──────────┐ create QR  ┌──────▼───────┐
│ Cashier  │───────────▶│   Xendit     │
└──────────┘            └─────────────┘
```

- **Orders** are created through the `create_order` Postgres RPC (security definer). It atomically inserts into `orders` + `order_items` and generates a human-readable `order_number` (`ORD-YYYYMMDD-NNNN`) from a daily counter.
- **Kitchen** subscribes to `postgres_changes` on `orders` + `order_items` and re-renders on arrival or status change.
- **Queue** entries are inserted when customers join via `/queue/join`. The host sees live updates via realtime and seats customers from the floor plan view. A WhatsApp link is generated for each customer with their queue token.
- **Payments** are created through the Xendit QR Codes API. The QR string is rendered client-side with `qrcode.react`. The payment page subscribes to its `payments` row for live status updates.
- **The webhook** at `/api/xendit/webhook` verifies the `x-callback-token` header, looks up the payment by `xendit_qr_id`, and updates `payments` + `orders` atomically.
- **Sales dashboard** in admin shows revenue, order counts, and item-level breakdowns using Recharts. Data can be exported to Excel via `xlsx`.

## File layout

```
app/
  login/                        # public login page + Server Actions
  menu/                         # public menu (no auth)
  queue/                        # public queue board + join form + status page
  pay/[paymentId]/              # customer payment screen
  403/                          # forbidden page
  (app)/
    layout.tsx                  # shared shell, auth guard
    waiter/                     # order list + new order + confirmation
    kitchen/                    # realtime queue board
    cashier/                    # payment list + [orderId] payment screen
    host/                       # floor plan + queue management
    admin/
      menu/                     # menu CRUD
      categories/               # category management
      users/                    # staff roles
      sales/                    # sales dashboard + Excel export
  api/xendit/webhook/           # Xendit payment callback
lib/
  supabase/                     # server, client, admin, middleware clients
  queue/                        # queue service, ETA, WhatsApp, token, no-show scheduler
  xendit.ts                     # Xendit QR Codes API wrapper
  auth.ts, types.ts, format.ts, status.ts, floor-plan.ts, payments.ts
supabase/
  migrations/
  seed.sql
components/
  ui/                           # shadcn primitives
  app-shell.tsx                 # role-aware sidebar
```

## Deploying

1. Push to GitHub and import into [Vercel](https://vercel.com).
2. Add the env vars from `.env.local.example` to the Vercel project.
3. Set `NEXT_PUBLIC_APP_URL` to your production URL.
4. Update the Xendit callback URL to `https://<your-domain>/api/xendit/webhook`.

## Out of scope (on purpose)

- Multi-outlet / multi-tenant
- Receipt printing (can add via ESC/POS or browser print)
- Inventory, discounts, taxes
- Full WhatsApp Business API integration (currently uses `wa.me` deep links)

These can be added incrementally without restructuring the schema.
