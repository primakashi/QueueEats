-- F01: channel-aware menu assignment.
-- Join table that restricts a menu item to specific channels (dine-in, GoFood,
-- a pop-up event, etc.). Backwards-compatible: an item with NO rows in this
-- table is treated as available on EVERY channel.

CREATE TABLE IF NOT EXISTS public.menu_item_channels (
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  channel_id text NOT NULL REFERENCES public.order_channels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (menu_item_id, channel_id)
);

CREATE INDEX IF NOT EXISTS menu_item_channels_channel_idx
  ON public.menu_item_channels (channel_id);

ALTER TABLE public.menu_item_channels ENABLE ROW LEVEL SECURITY;

-- Default-permissive policy mirroring menu_items: anyone who can read the menu
-- can read the assignment. Tighten via roles later if needed.
DROP POLICY IF EXISTS menu_item_channels_read ON public.menu_item_channels;
CREATE POLICY menu_item_channels_read
  ON public.menu_item_channels
  FOR SELECT
  USING (true);

-- Writes restricted to authenticated users; finer-grained role checks happen
-- in server actions (admin/branch_manager).
DROP POLICY IF EXISTS menu_item_channels_write ON public.menu_item_channels;
CREATE POLICY menu_item_channels_write
  ON public.menu_item_channels
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
