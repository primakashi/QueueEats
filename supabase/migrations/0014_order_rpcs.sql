-- F15: Server-side RPCs for the slow mutation hot paths.
--   - recalc_order_total: SQL port of recalcTotal() in edit-actions.ts
--   - update_order_item_with_recalc: 1-round-trip qty edit (replaces ~10
--     JS round-trips in updateOrderItemQty)
--   - create_order_v2: wraps create_order + the post-RPC patches that JS
--     used to do (restaurant_id stamp, service_type, parent_order_id,
--     stock decrement, tax/service) into one transaction.
-- All functions are CREATE OR REPLACE so the migration is idempotent.

-- ============================================================================
-- recalc_order_total: recompute subtotal, per-discount amounts, tax,
-- service, total. Mirrors the JS recalcTotal exactly: discounts are applied
-- in created_at order with stack-aware base reduction, then tax/service
-- compute off the discounted subtotal.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalc_order_total(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_rest RECORD;
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

  -- Subtotal + per-item map (used for menu_item-scope discounts).
  SELECT
    COALESCE(SUM(price_snapshot * quantity), 0),
    COALESCE(jsonb_object_agg(id::text, price_snapshot * quantity), '{}'::jsonb)
  INTO v_subtotal, v_remaining_item_base
  FROM public.order_items WHERE order_id = p_order_id;

  v_remaining_txn_base := v_subtotal;

  -- Restaurant tax/service settings.
  IF v_order.restaurant_id IS NOT NULL THEN
    SELECT tax_rate, service_charge_rate, service_charge_channels, round_total INTO v_rest
      FROM public.restaurants WHERE id = v_order.restaurant_id;
    IF FOUND THEN
      v_tax_rate := COALESCE(v_rest.tax_rate, 0);
      v_channel_applies :=
        COALESCE(array_length(v_rest.service_charge_channels, 1), 0) = 0
        OR v_order.order_channel = ANY(v_rest.service_charge_channels);
      v_service_rate := CASE WHEN v_channel_applies THEN COALESCE(v_rest.service_charge_rate, 0) ELSE 0 END;
      v_round_total := COALESCE(v_rest.round_total, false);
    END IF;
  END IF;

  -- Apply discounts in insertion order; stack-aware base reduction.
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
  v_total := CASE WHEN v_round_total THEN ROUND(v_raw_total / 1000) * 1000 ELSE v_raw_total END;

  UPDATE public.orders SET
    subtotal = v_subtotal,
    total = v_total,
    tax_amount = v_tax_amount,
    service_charge_amount = v_service_charge_amount,
    discount_amount = v_discount_amount
  WHERE id = p_order_id;
END;
$$;

-- ============================================================================
-- update_order_item_with_recalc: change/remove an order item line in one
-- round-trip. Locks the order row to serialize concurrent edits. Returns
-- jsonb {ok, error?, order?} matching the existing JS Result shape.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_order_item_with_recalc(
  p_order_id uuid,
  p_item_id uuid,
  p_qty integer,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_old_qty int;
  v_new_qty int;
  v_delta int;
  v_stock_date date;
  v_daily_stock_id uuid;
  v_order_json jsonb;
BEGIN
  SELECT id, outlet_id, payment_status, status, created_at INTO v_order
    FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pesanan tidak ditemukan');
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pesanan sudah dibayar');
  END IF;

  SELECT id, menu_item_id, quantity INTO v_item
    FROM public.order_items
    WHERE id = p_item_id AND order_id = p_order_id;
  v_old_qty := COALESCE(v_item.quantity, 0);
  v_new_qty := GREATEST(p_qty, 0);

  IF v_new_qty <= 0 THEN
    DELETE FROM public.order_items WHERE id = p_item_id AND order_id = p_order_id;
  ELSE
    UPDATE public.order_items SET quantity = v_new_qty
      WHERE id = p_item_id AND order_id = p_order_id;
  END IF;

  -- Best-effort stock adjustment (matches adjustStockForEdit in JS).
  v_delta := v_old_qty - v_new_qty;
  IF v_delta <> 0
     AND v_item.menu_item_id IS NOT NULL
     AND v_order.outlet_id IS NOT NULL
     AND v_order.status <> 'cancelled'
  THEN
    v_stock_date := (v_order.created_at AT TIME ZONE 'UTC')::date;
    SELECT id INTO v_daily_stock_id FROM public.daily_stock
      WHERE outlet_id = v_order.outlet_id
      AND menu_item_id = v_item.menu_item_id
      AND stock_date = v_stock_date;
    IF FOUND THEN
      PERFORM public.adjust_daily_stock(
        p_daily_stock_id := v_daily_stock_id,
        p_change := v_delta,
        p_reason := 'adjust',
        p_order_id := p_order_id,
        p_notes := 'Edit pesanan',
        p_actor := p_actor
      );
    END IF;
  END IF;

  PERFORM public.recalc_order_total(p_order_id);

  SELECT to_jsonb(o) INTO v_order_json FROM public.orders o WHERE o.id = p_order_id;
  RETURN jsonb_build_object('ok', true, 'order', v_order_json);
END;
$$;

-- ============================================================================
-- create_order_v2: wraps the existing create_order RPC + the post-RPC
-- patches that waiter/actions.ts createOrder did sequentially. One
-- transaction = one round-trip from JS.
--
-- Caller is responsible for the items/order_channel/outlet_id payload shape
-- already accepted by create_order. Extra fields:
--   - p_payload.service_type            (default 'dine_in')
--   - p_payload.parent_order_id         (optional)
-- Caller also passes the restaurant_id for stamping (HQ accounts whose
-- order has no outlet_id get nothing from the DB trigger).
-- ============================================================================

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
  v_rest RECORD;
  v_service_type text;
  v_parent_order_id uuid;
  v_subtotal numeric;
  v_tax_amount numeric;
  v_service_charge_amount numeric;
  v_total numeric;
  v_tax_rate numeric := 0;
  v_service_rate numeric := 0;
  v_round_total boolean := false;
  v_channel_applies boolean;
  v_item RECORD;
  v_stock_date date;
  v_daily_stock_id uuid;
  v_result jsonb;
BEGIN
  -- Defer to the existing create_order for the heavy work
  -- (order_number generation, items insert, RLS plumbing).
  SELECT * INTO v_order FROM public.create_order(p_payload);
  v_order_id := v_order.id;

  v_service_type := COALESCE(p_payload->>'service_type', 'dine_in');
  v_parent_order_id := NULLIF(p_payload->>'parent_order_id', '')::uuid;

  -- All three patches in one UPDATE.
  -- service_type column is an enum (order_service_type) so cast explicitly.
  UPDATE public.orders SET
    service_type = v_service_type::public.order_service_type,
    parent_order_id = COALESCE(v_parent_order_id, parent_order_id),
    restaurant_id = COALESCE(restaurant_id, p_restaurant_id)
  WHERE id = v_order_id;

  -- Stock decrement (one-shot loop in SQL = no JS round-trips).
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

  -- Apply tax/service from restaurants config. Mirrors waiter/actions.ts.
  IF COALESCE(p_restaurant_id, v_order.restaurant_id) IS NOT NULL THEN
    SELECT tax_rate, service_charge_rate, service_charge_channels, round_total INTO v_rest
      FROM public.restaurants
      WHERE id = COALESCE(p_restaurant_id, v_order.restaurant_id);
    IF FOUND THEN
      v_tax_rate := COALESCE(v_rest.tax_rate, 0);
      v_channel_applies :=
        COALESCE(array_length(v_rest.service_charge_channels, 1), 0) = 0
        OR v_order.order_channel = ANY(v_rest.service_charge_channels);
      v_service_rate := CASE WHEN v_channel_applies THEN COALESCE(v_rest.service_charge_rate, 0) ELSE 0 END;
      v_round_total := COALESCE(v_rest.round_total, false);

      IF v_tax_rate > 0 OR v_service_rate > 0 OR v_round_total THEN
        v_subtotal := COALESCE(v_order.subtotal, v_order.total);
        v_tax_amount := ROUND(v_subtotal * v_tax_rate);
        v_service_charge_amount := ROUND(v_subtotal * v_service_rate);
        v_total := v_subtotal + v_tax_amount + v_service_charge_amount;
        IF v_round_total THEN
          v_total := ROUND(v_total / 1000) * 1000;
        END IF;
        UPDATE public.orders SET
          tax_amount = v_tax_amount,
          service_charge_amount = v_service_charge_amount,
          total = v_total
        WHERE id = v_order_id;
      END IF;
    END IF;
  END IF;

  -- Return fully patched order.
  SELECT to_jsonb(o) INTO v_result FROM public.orders o WHERE o.id = v_order_id;
  RETURN v_result;
END;
$$;
