-- Fix P0/P1 order correctness issues found during tenant acceptance testing.
--
-- Precedence for tax and service rates is explicit:
--   1. a positive outlet rate overrides the restaurant rate;
--   2. zero at outlet level inherits the restaurant rate;
--   3. missing values resolve to zero.

CREATE OR REPLACE FUNCTION public.recalc_order_total(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_rest_tax_rate numeric := 0;
  v_rest_service_rate numeric := 0;
  v_rest_service_channels text[] := ARRAY[]::text[];
  v_rest_round_total boolean := false;
  v_outlet_tax_rate numeric := 0;
  v_outlet_service_rate numeric := 0;
  v_subtotal numeric := 0;
  v_discount_amount numeric := 0;
  v_tax_amount numeric;
  v_service_charge_amount numeric;
  v_discounted_subtotal numeric;
  v_total numeric;
  v_raw_total numeric;
  v_tax_rate numeric := 0;
  v_service_rate numeric := 0;
  v_channel_applies boolean;
  v_round_total boolean := false;
  v_remaining_txn_base numeric;
  v_remaining_item_base jsonb;
  d RECORD;
  v_base numeric;
  v_new_amount numeric;
BEGIN
  SELECT outlet_id, restaurant_id, order_channel INTO v_order
    FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT
    COALESCE(SUM(price_snapshot * quantity), 0),
    COALESCE(jsonb_object_agg(id::text, price_snapshot * quantity), '{}'::jsonb)
  INTO v_subtotal, v_remaining_item_base
  FROM public.order_items WHERE order_id = p_order_id;

  v_remaining_txn_base := v_subtotal;

  IF v_order.restaurant_id IS NOT NULL THEN
    SELECT tax_rate, service_charge_rate, service_charge_channels, round_total
      INTO v_rest_tax_rate, v_rest_service_rate, v_rest_service_channels, v_rest_round_total
      FROM public.restaurants WHERE id = v_order.restaurant_id;
  END IF;
  IF v_order.outlet_id IS NOT NULL THEN
    SELECT tax_rate, service_charge_rate INTO v_outlet_tax_rate, v_outlet_service_rate
      FROM public.outlets WHERE id = v_order.outlet_id;
  END IF;

  v_tax_rate := COALESCE(NULLIF(v_outlet_tax_rate, 0), v_rest_tax_rate, 0);
  v_service_rate := COALESCE(NULLIF(v_outlet_service_rate, 0), v_rest_service_rate, 0);
  v_channel_applies :=
    COALESCE(array_length(v_rest_service_channels, 1), 0) = 0
    OR v_order.order_channel = ANY(v_rest_service_channels);
  IF NOT v_channel_applies THEN v_service_rate := 0; END IF;
  v_round_total := COALESCE(v_rest_round_total, false);

  FOR d IN
    SELECT id, scope, value_type, value_snapshot, amount, order_item_id
    FROM public.order_discounts
    WHERE order_id = p_order_id
    ORDER BY created_at ASC
  LOOP
    IF d.scope = 'menu_item' AND d.order_item_id IS NOT NULL THEN
      v_base := COALESCE((v_remaining_item_base->>(d.order_item_id::text))::numeric, 0);
    ELSE
      v_base := v_remaining_txn_base;
    END IF;

    IF v_base <= 0 THEN
      v_new_amount := 0;
    ELSIF d.value_type = 'amount' THEN
      v_new_amount := ROUND(d.value_snapshot);
    ELSE
      v_new_amount := ROUND((d.value_snapshot / 100.0) * v_base);
    END IF;
    v_new_amount := GREATEST(0, LEAST(v_new_amount, v_base));

    IF v_new_amount <> COALESCE(d.amount, 0) THEN
      UPDATE public.order_discounts SET amount = v_new_amount WHERE id = d.id;
    END IF;

    IF d.scope = 'menu_item' AND d.order_item_id IS NOT NULL THEN
      v_remaining_item_base := jsonb_set(
        v_remaining_item_base,
        ARRAY[d.order_item_id::text],
        to_jsonb(v_base - v_new_amount)
      );
    END IF;
    v_remaining_txn_base := GREATEST(0, v_remaining_txn_base - v_new_amount);
    v_discount_amount := v_discount_amount + v_new_amount;
  END LOOP;

  v_discounted_subtotal := GREATEST(0, v_subtotal - v_discount_amount);
  v_tax_amount := ROUND(v_discounted_subtotal * v_tax_rate);
  v_service_charge_amount := ROUND(v_discounted_subtotal * v_service_rate);
  v_raw_total := v_discounted_subtotal + v_tax_amount + v_service_charge_amount;
  v_total := CASE
    WHEN v_round_total THEN ROUND(v_raw_total / 1000) * 1000
    ELSE v_raw_total
  END;

  UPDATE public.orders SET
    subtotal = v_subtotal,
    total = v_total,
    tax_amount = v_tax_amount,
    service_charge_amount = v_service_charge_amount,
    discount_amount = v_discount_amount
  WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_order_v2(
  p_payload jsonb,
  p_actor uuid,
  p_restaurant_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_order_id uuid;
  v_service_type text;
  v_parent_order_id uuid;
  v_order_channel text;
  v_item RECORD;
  v_stock_date date;
  v_daily_stock_id uuid;
  v_result jsonb;
BEGIN
  SELECT * INTO v_order FROM public.create_order(p_payload);
  v_order_id := v_order.id;

  v_service_type := COALESCE(p_payload->>'service_type', 'dine_in');
  v_parent_order_id := NULLIF(p_payload->>'parent_order_id', '')::uuid;
  v_order_channel := COALESCE(NULLIF(p_payload->>'order_channel', ''), 'direct');

  UPDATE public.orders SET
    service_type = v_service_type::public.order_service_type,
    parent_order_id = COALESCE(v_parent_order_id, parent_order_id),
    restaurant_id = COALESCE(restaurant_id, p_restaurant_id),
    order_channel = v_order_channel
  WHERE id = v_order_id;

  -- Re-read the canonical row after patching. Charge applicability must use
  -- the selected channel, not the stale row returned by create_order().
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;

  IF v_order.outlet_id IS NOT NULL THEN
    v_stock_date := (now() AT TIME ZONE 'UTC')::date;
    FOR v_item IN
      SELECT menu_item_id, quantity FROM public.order_items WHERE order_id = v_order_id
    LOOP
      IF v_item.menu_item_id IS NULL THEN CONTINUE; END IF;
      SELECT id INTO v_daily_stock_id FROM public.daily_stock
        WHERE outlet_id = v_order.outlet_id
        AND menu_item_id = v_item.menu_item_id
        AND stock_date = v_stock_date;
      IF FOUND THEN
        PERFORM public.adjust_daily_stock(
          p_daily_stock_id := v_daily_stock_id,
          p_change := -v_item.quantity,
          p_reason := 'sale',
          p_order_id := v_order_id,
          p_notes := NULL,
          p_actor := p_actor
        );
      END IF;
    END LOOP;
  END IF;

  -- Keep creation and later edits on one canonical calculation path.
  PERFORM public.recalc_order_total(v_order_id);

  SELECT to_jsonb(o) INTO v_result FROM public.orders o WHERE o.id = v_order_id;
  RETURN v_result;
END;
$$;
