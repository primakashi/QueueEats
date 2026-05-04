-- Mock payment helpers — only touch payments whose provider = 'mock'.
-- Real Xendit payments are still handled via the /api/xendit webhook path.
-- These RPCs are SECURITY DEFINER so they work without the service_role key.

-- Returns a jsonb summary (payment + order + items) or null if not a mock payment.
create or replace function public.get_mock_payment(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'payment_id',     p.id,
    'payment_status', p.status,
    'amount',         p.amount,
    'paid_at',        p.paid_at,
    'order_id',       o.id,
    'order_number',   o.order_number,
    'customer_name',  o.customer_name,
    'table_number',   o.table_number,
    'items',          coalesce(
      (select jsonb_agg(jsonb_build_object(
        'name',       oi.name_snapshot,
        'quantity',   oi.quantity,
        'unit_price', oi.price_snapshot,
        'line_total', oi.line_total
      ) order by oi.created_at)
      from public.order_items oi where oi.order_id = o.id),
      '[]'::jsonb
    )
  )
  into result
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.id = pid
    and p.provider = 'mock';

  return result;
end;
$$;

-- Mark a mock payment as paid + flip the order to paid+completed.
-- Idempotent: if already paid, returns { ok: true, already_paid: true }.
create or replace function public.complete_mock_payment(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id      uuid;
  v_status        payment_status_enum;
begin
  select p.order_id, p.status
    into v_order_id, v_status
  from public.payments p
  where p.id = pid
    and p.provider = 'mock';

  if v_order_id is null then
    return jsonb_build_object('ok', false, 'error', 'Payment not found');
  end if;

  if v_status = 'paid' then
    return jsonb_build_object('ok', true, 'already_paid', true);
  end if;

  update public.payments
     set status = 'paid',
         paid_at = now(),
         updated_at = now()
   where id = pid;

  update public.orders
     set payment_status = 'paid',
         payment_method = 'qris',
         status = 'completed',
         updated_at = now()
   where id = v_order_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_mock_payment(uuid)      to anon, authenticated;
grant execute on function public.complete_mock_payment(uuid) to anon, authenticated;
