-- Add is_active flag on restaurants so the superadmin UI can hide
-- archived / dummy restaurants without hard-deleting rows.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS restaurants_is_active_idx
  ON public.restaurants (is_active);
