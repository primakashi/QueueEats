# QueueEats — Roles, Flows & UI/UX Revamp

> Repository snapshot of the [working Google Doc](https://docs.google.com/document/d/1uDYiRgWnj2ZRa-jgPVOxiIR8dSaiWaOSIavdKaCdPd8/edit).
>
> Source revision: `AIroW34Pq4dfFXPlSxPek-UCJPyke1VHp-LdfvHZIwJz5-Sa53LICsln-QjyhLuRu0tJ32YEUMDekYdNucgHswtK2l-Ny-H_chRa4r-09QY`
>
> Current-state baseline: codebase `c2dd4c1`. Screenshots remain in the Google Doc; this file is the reviewable text version.

Roles, flows, current UI, and revamp recommendations.

## 01. Roles & Capabilities

### Super Admin

Scope: all restaurants/tenants.

- Onboard new restaurants.
- Manage subscriptions and tenant status.
- View cross-tenant lists and analytics.

### Owner

Scope: one restaurant, all outlets.

- Monitor sales and business summaries.
- Compare outlet performance.
- Manage business, outlet, menu, and staff configuration according to page guards.

### Finance

Scope: one restaurant, all outlets.

- Access sales reports and business summaries.
- Monitor cashier sessions and cash movements.
- Review expected versus actual cash and reconciliation.

### Admin

Scope: one restaurant, all outlets.

- Manage menus, categories, discounts, stock, channels, payments, taxes, service charges, and workflows.
- Manage staff, roles, outlets, archive/restore, and password resets.
- View audit, order, cash, and stock logs.

### Branch Manager

Scope: one outlet.

- Manage daily branch operations.
- Monitor orders, queues, stock, kitchen, cashier, and outlet configuration.
- Acts as the broadest operational role at outlet level.

### Cashier

Scope: one outlet.

- Open and close cashier sessions.
- View unpaid and paid orders.
- Accept cash or EDC, record cash in/out, and print receipts.
- Edit orders only while guards allow it; paid orders are locked.

### Waiter

Scope: one outlet.

- Create orders and select channel, table/customer, items, and quantities.
- Monitor order status and kitchen handoff.
- Add items/add-ons, reopen, edit, or cancel according to status and permissions.

### Kitchen

Scope: one outlet.

- Receive orders in real time.
- Move orders from `accepted` → `preparing` → `ready`.
- Print or use kitchen tickets; does not handle payment.

### Role gap

Host is not a formal role, but the `/host` workspace and queue operations exist. Access currently attaches to other roles while the Host sidebar link is hidden.

## 02. Flow Map

### Authentication & role routing

Email/password → Supabase Auth → load profile → resolve restaurant/outlet → cache `qe_profile` → redirect to the role home.

- `super_admin` → `/superadmin`
- `owner` / `finance` → `/admin/sales`
- `admin` / `branch_manager` → `/admin/menu`
- `kitchen` → `/kitchen`
- `cashier` / `waiter` → `/waiter`

### Standard order

Waiter creates order → `pending` → `accepted` → `preparing` → `ready` → Cashier payment → `paid` → `completed`.

- Orders are created atomically through `create_order_v2`.
- Prices, taxes, service charges, and items are stored as snapshots.
- Tracked stock decreases when the order is created.
- A channel may bypass `pending` when it does not require acceptance.

### No-kitchen order

Create order → kitchen step skipped/shortened → ready for completion/payment.

- The UI must not show irrelevant kitchen statuses.
- Workflow configuration determines the mode.

### Edit, discount & cancellation

Edit quantity/apply discount → RPC recalculation → totals updated → stock adjustment logged.

- Normal cancellation is allowed only from `pending` or `accepted`.
- Cancellation restores tracked stock on a best-effort basis.
- Paid-order guards block changes after settlement.

### Cashier shift & payment

Open session → opening cash → payments and cash movements → close session → actual cash → difference/reconciliation.

- Cash and EDC are active.
- QRIS/Xendit scaffolding exists, but starting QRIS is currently disabled.
- Receipts are printed through browser print.

### Queue & seating

Join → `waiting` → `called` → `seated` → `completed`.

- Only the first waiting entry may be called.
- Customers may self-cancel only while waiting.
- Other terminal states are `cancelled` and `no_show`.
- Host assigns a table; public board/status polling runs about every 10 seconds.
- WhatsApp remains a manual `wa.me` action.

### Stock impact

Opening stock/stock addition → order decrement → edit/cancel adjustment → stock movement log.

- Stock can be tracked per item and outlet quota.
- Every important change must remain auditable.

### Admin setup

Restaurant/outlet → staff and roles → menu and stock → channels and payment → tax/service/workflow → print test → operations.

### Reporting & Super Admin

Operational data → sales/business summary → cashier sessions → reconciliation → outlet comparison.

- Super Admin sees tenant-level health and subscriptions.
- Owner/Finance sees restaurant-level performance.

## 03. Current UI

### Landing page

The current landing page is strong in brand terms: editorial typography, olive–orange palette, a clear product story, and WhatsApp CTA.

### Login

Login is minimal and operational, but continuity with the landing page's visual language is still weak.

### Protected screens

Protected screens were validated through tenant testing with Pempek Omah / Cabang Traveloka. Screenshots and observed flows are in section 06 of the Google Doc; test findings are listed below.

## 04. Recommended Improvements

### P0 — Fix before screen redesign

- Unify navigation visibility, direct page access, and mutation authority in one capability matrix.
- Make staging reproducible with a dummy tenant, seed data, and accounts for every role.
- Create a `/dev/ui` playground for default, loading, empty, error, offline, reconnect, and success states.
- Lock critical flows with Playwright and visual regression.
- Consolidate design tokens around a grayscale/black-and-white base; use status colors only when they convey operational meaning.

### P1 — Operational UX

- Change the information architecture to task-based groups: Service, Kitchen, Cashier, Catalog & Stock, and Management.
- Show outlet context and active shift persistently.
- Use one primary next action for each status; destructive actions must explain stock/payment impact.
- Show Waiter → Kitchen → Cashier handoff as a timeline with owner and elapsed time.
- Optimize touch targets, sticky actions, and adaptive layouts for tablets and phones.
- Add realtime connection state, retry, and duplicate-submit protection.
- Make Host an official workspace or remove the unsupported hidden route.

### P2 — Management & growth

- Combine Business Summary and Sales into one reporting hierarchy.
- Create a setup wizard for outlet, workflow, channel, payment, tax, staff, menu, stock, and printing.
- Decide the product status of QRIS, WhatsApp automation, and Saji AI so UI and marketing remain consistent.
- Standardize Indonesian terminology, currency/date/time, accessibility, and receipt/kitchen print previews.

## 05. How to Change a Flow

- Update the current flow in this document and write the proposed flow directly below it.
- Record affected roles, permissions, statuses, data/RPCs, edge cases, and invariants.
- Build a prototype with safe fixtures; review it per role and device.
- After approval, the implementation PR must link the flow and prototype; merge after regression tests pass.

## 06. Tested Flows & Screens

Test context: Pempek Omah · Cabang Traveloka · Admin.

### Order, discount & payment

Tested flow: new order → select type/channel → add item → customer/note → submit → edit quantity → 10% discount → accepted → preparing → ready → cash payment → completed.

Observed: quantity 2→3 updated subtotal Rp24,000→Rp36,000, discount Rp3,600, and final total Rp32,400. The paid order became read-only.

### Kitchen lifecycle

Tested flow: `pending` → `accepted` → `preparing` → `ready`.

Observed: the order appeared on `/kitchen` and moved between columns. Admin could open Kitchen directly although its navigation item was hidden.

### Cashier & cash drawer

Tested flow: active session → unpaid order → payment method → payment accepted → receipt state.

Observed: cash in Rp1,000 and cash out Rp1,000 were recorded and balanced. The existing cashier session remained open.

### Stock

Tested flow: confirm opening stock 10 → add 3 → order quantity 3 decrements stock → remaining 10.

Observed: stock arithmetic passed and the operational log recorded the movement.

### Queue & seating

Tested flow: walk-in/public join → `waiting` → `called` → seated at I-5 → completed/table cleared.

Observed: customer arrival confirmation and self-cancel were also tested without sending WhatsApp.

### Reporting & audit

Tested flow: completed payment → sales summary and payment/channel composition → operational log.

Observed: the Rp32,400 sale, cash movements, and stock adjustments appeared in reporting/audit.

## 07. Bug Findings

### P0 — Blocking

- **Queue tenant isolation:** the logged-in tenant was Pempek Omah, but `/host`, `/queue`, and `/queue/join` displayed “Warung Pak Bowo”. Fixed by [PR #2](https://github.com/primakashi/QueueEats/pull/2).
- **Order channel persistence:** Online + CODEX TEST Online was selected, but the order was stored as `direct` / Takeaway. Fixed by [PR #2](https://github.com/primakashi/QueueEats/pull/2).

### P1 — Operational correctness

- **Tax/service precedence:** PPN 10% and service 5% were enabled but did not enter the order total; global versus outlet precedence was not explained. Fixed by [PR #2](https://github.com/primakashi/QueueEats/pull/2).
- **Stale state after mutation:** order status, stock, cash, and configuration frequently required reload before the new state appeared. Fixed by [PR #2](https://github.com/primakashi/QueueEats/pull/2).
- **Non-atomic recalculation UI:** quantity changed to 3 while subtotal/discount temporarily remained based on quantity 2 for about 1–2 seconds. Fixed by [PR #2](https://github.com/primakashi/QueueEats/pull/2).
- **Stock log mismatch:** the Stock page showed “Belum ada perubahan stok hari ini” while the central operational log contained +3 and −1 entries. Fixed by [PR #2](https://github.com/primakashi/QueueEats/pull/2).
- **Custom payment mapping:** active custom method CODEX TEST Pay did not appear in the Cashier payment selector. Fixed by [PR #2](https://github.com/primakashi/QueueEats/pull/2).

### P2 — Navigation & clarity

- **Hidden supported workspaces:** Kitchen and Host are reachable directly for Admin but absent from the sidebar.
- **Cashier log date mismatch:** the current test session appeared with an inconsistent historical date in the cashier log table.
- **Queue cancellation guard:** “Saya tidak jadi datang” cancels immediately without confirmation.
- **Icon accessibility:** several quantity/delete/menu icon controls have no visible or accessible label.

## Maintenance

The Google Doc remains the richer working document and contains the screenshots. When it changes materially, update this file in the same product or implementation PR so decisions and findings stay versioned alongside the code.
