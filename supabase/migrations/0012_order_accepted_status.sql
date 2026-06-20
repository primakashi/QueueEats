-- F13: Introduce `accepted` ("Diterima") as a distinct stage between pending
-- and preparing. The full order lifecycle is now:
--   pending → accepted → preparing → ready → completed   (standard / kitchen)
--   pending → accepted → ready → completed               (no_kitchen)
-- Cancellation is only allowed from pending or accepted; once an order is in
-- preparing the kitchen owns it and cancellation must go through reopen/admin.
--
-- Handles two schema shapes:
--   (a) orders.status is a real ENUM type `order_status` — extend the enum.
--   (b) orders.status is text with a CHECK constraint — drop + recreate it.

DO $$
DECLARE
  is_enum boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'order_status'
      AND n.nspname = 'public'
      AND t.typtype = 'e'
  ) INTO is_enum;

  IF is_enum THEN
    -- Add 'accepted' to the enum if it isn't already present. Positioned
    -- before 'preparing' to match the lifecycle order (cosmetic only).
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'order_status'
        AND n.nspname = 'public'
        AND e.enumlabel = 'accepted'
    ) THEN
      EXECUTE 'ALTER TYPE public.order_status ADD VALUE ''accepted'' BEFORE ''preparing''';
    END IF;
  ELSE
    -- Text + CHECK constraint shape: drop any existing status check and
    -- recreate with the expanded value set.
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
    END;

    EXECUTE $sql$
      ALTER TABLE public.orders
        ADD CONSTRAINT orders_status_check
        CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'))
    $sql$;
  END IF;
END $$;
