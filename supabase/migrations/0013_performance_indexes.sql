-- F14: Performance indexes for the hot-path queries identified in the
-- /admin/log, /admin/sales, /admin/ringkasan-bisnis, /admin/cashier-sessions,
-- /cashier, /cashier/[orderId], and recalcTotal flows. All idempotent.

-- /admin/sales, /admin/ringkasan-bisnis, /admin/log orders tab, /cashier
-- order lists — gte(created_at) scans filtered by restaurant_id or outlet_id.
CREATE INDEX IF NOT EXISTS orders_restaurant_created_at_idx
  ON public.orders (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_outlet_created_at_idx
  ON public.orders (outlet_id, created_at DESC);

-- /admin/cashier-sessions cashSales + /admin/log cashSales: filter on
-- payment_method='cash' AND payment_status='paid', then gte(updated_at).
-- Partial index keeps it small since most orders aren't cash-paid.
CREATE INDEX IF NOT EXISTS orders_cash_paid_updated_at_idx
  ON public.orders (updated_at DESC)
  WHERE payment_method = 'cash' AND payment_status = 'paid';

-- /admin/cashier-sessions + /admin/log: movements grouped by session_id.
CREATE INDEX IF NOT EXISTS cash_movements_session_id_idx
  ON public.cash_movements (session_id);

-- /admin/log audit tab: in(changed_by_id, ...) + order by created_at desc.
CREATE INDEX IF NOT EXISTS audit_logs_changed_by_created_at_idx
  ON public.audit_logs (changed_by_id, created_at DESC);

-- /waiter/new + /cashier/[orderId] daily stock lookup: stock_date + outlet_id.
CREATE INDEX IF NOT EXISTS daily_stock_outlet_stock_date_idx
  ON public.daily_stock (outlet_id, stock_date);

-- recalcTotal + sales/ringkasan: items per order.
CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON public.order_items (order_id);

-- recalcTotal: order_discounts re-read every edit, ordered by created_at.
CREATE INDEX IF NOT EXISTS order_discounts_order_id_created_at_idx
  ON public.order_discounts (order_id, created_at);

-- /admin/log stock tab: stock_movements with outlet + time filter.
CREATE INDEX IF NOT EXISTS stock_movements_outlet_created_at_idx
  ON public.stock_movements (outlet_id, created_at DESC);
