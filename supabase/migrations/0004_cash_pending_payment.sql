-- Pending cash flow mirrors mock QRIS: cashier starts a pending row, then
-- complete_cash_payment (SECURITY DEFINER) finalizes without service_role.

create or replace function public.complete_cash_payment(pid uuid)
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
    and p.provider = 'cash';

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
         payment_method = 'cash',
         status = 'completed',
         updated_at = now()
   where id = v_order_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.complete_cash_payment(uuid) to anon, authenticated;
