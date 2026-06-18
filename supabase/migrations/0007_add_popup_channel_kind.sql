-- F02: Add 'popup' as a first-class channel kind alongside 'direct' and 'online'.
-- Idempotent: drops any existing CHECK constraint on order_channels.kind, then
-- recreates one that accepts the new value. Safe to re-run.

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE rel.relname = 'order_channels'
      AND ns.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.order_channels DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.order_channels
  ADD CONSTRAINT order_channels_kind_check
  CHECK (kind IS NULL OR kind IN ('direct', 'online', 'popup'));
