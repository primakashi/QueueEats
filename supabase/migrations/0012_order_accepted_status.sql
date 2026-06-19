-- F13: Introduce `accepted` ("Diterima") as a distinct stage between pending
-- and preparing. The full order lifecycle is now:
--   pending → accepted → preparing → ready → completed   (standard / kitchen)
--   pending → accepted → ready → completed               (no_kitchen)
-- Cancellation is only allowed from pending or accepted; once an order is in
-- preparing the kitchen owns it and cancellation must go through reopen/admin.

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE rel.relname = 'orders'
      AND ns.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%payment_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'));
