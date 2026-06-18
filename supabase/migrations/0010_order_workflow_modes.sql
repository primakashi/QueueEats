-- F10: Configurable order workflow.
--   restaurants.order_workflow: 'standard' (pending→preparing→ready→completed)
--                               or 'no_kitchen' (pending→ready→completed, skips kitchen).
--   order_channels.requires_acceptance: when true, pending orders from this
--     channel must be explicitly accepted or rejected by staff before they can
--     advance — used for online channels where bad orders should be refusable.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS order_workflow text NOT NULL DEFAULT 'standard';

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE rel.relname = 'restaurants'
      AND ns.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%order_workflow%'
  LOOP
    EXECUTE format('ALTER TABLE public.restaurants DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_order_workflow_check
  CHECK (order_workflow IN ('standard', 'no_kitchen'));

ALTER TABLE public.order_channels
  ADD COLUMN IF NOT EXISTS requires_acceptance boolean NOT NULL DEFAULT false;
