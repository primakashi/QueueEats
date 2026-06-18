-- F03: per-item commission override.
-- Null = use the channel's commission_rate. Set = override for this item only.
-- Effective rate per item line: COALESCE(menu_items.commission_rate, order_channels.commission_rate, 0).

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,4);

-- Stored as a fraction (0.20 = 20%), matching order_channels.commission_rate.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE rel.relname = 'menu_items'
      AND ns.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%commission_rate%'
  LOOP
    EXECUTE format('ALTER TABLE public.menu_items DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_commission_rate_check
  CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 1));
