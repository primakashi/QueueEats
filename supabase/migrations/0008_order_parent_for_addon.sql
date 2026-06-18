-- F12: Add-on / revise orders.
-- parent_order_id lets a follow-up order (e.g. customer wants more after paying)
-- be linked to the original. Reports + reconciliation can still treat each row
-- independently; the column exists for grouping in views and audit.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parent_order_id uuid
    REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_parent_order_id_idx
  ON public.orders (parent_order_id)
  WHERE parent_order_id IS NOT NULL;
