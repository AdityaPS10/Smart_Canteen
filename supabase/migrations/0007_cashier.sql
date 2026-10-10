-- Cash Counter (spec section 6).

-- A cashier's resubmitted request creates one order.
create unique index if not exists orders_cashier_request_uq on orders (client_request_id) where source = 'cashier';

-- Cash received: order created PAID straight away with a cash payment row, then "token and bill created".
-- No entrance QR and no UPI. Cash orders join the same kitchen queue (same paid_at ordering).
create or replace function cashier_create_order(
  p_canteen_id uuid, p_cashier_id uuid, p_items jsonb, p_customer_name text, p_client_request_id uuid
) returns jsonb
language plpgsql as $$
declare
  o orders;
begin
  if not exists (select 1 from profiles where id = p_cashier_id and role = 'cashier' and canteen_id = p_canteen_id) then
    raise exception using message = 'FORBIDDEN';
  end if;

  if p_client_request_id is not null then
    select * into o from orders where source = 'cashier' and client_request_id = p_client_request_id;
    if found then
      return jsonb_build_object('order_id', o.id, 'created', false, 'status', o.status, 'token_number', o.token_number);
    end if;
  end if;

  insert into orders (canteen_id, student_id, source, customer_name, service_date, status, total_paise, client_request_id, created_at)
  values (p_canteen_id, null, 'cashier', nullif(trim(coalesce(p_customer_name, '')), ''), ist_date(app_now()),
          'PENDING_PAYMENT', 0, p_client_request_id, app_now())
  returning * into o;

  perform _reserve_items(o.id, p_canteen_id, p_items);
  insert into order_events (order_id, event, at, meta) values (o.id, 'created', app_now(), '{"source":"cashier"}');
  select * into o from orders where id = o.id;

  insert into payments (order_id, method, status, attempt_no, amount_paise, cashier_id, created_at, updated_at)
  values (o.id, 'cash', 'success', 1, o.total_paise, p_cashier_id, app_now(), app_now());
  update orders set payment_attempts = 1 where id = o.id;

  o := _finalize_paid(o.id, jsonb_build_object('method', 'cash'));
  return jsonb_build_object('order_id', o.id, 'created', true, 'status', o.status, 'token_number', o.token_number,
                            'canteen_id', o.canteen_id);
end $$;

-- Payments log: cash payments of the day (Asia/Kolkata) with a running total.
create or replace function cashier_payments(p_canteen_id uuid, p_date date default null) returns jsonb
language sql stable as $$
  with d as (select coalesce(p_date, ist_date(app_now())) as day),
  cash_log as (
    select p.created_at, o.token_number, p.amount_paise, pr.full_name as cashier,
           sum(p.amount_paise) over (order by p.created_at, p.id) as running_total_paise
    from payments p
    join orders o on o.id = p.order_id
    left join profiles pr on pr.id = p.cashier_id
    cross join d
    where o.canteen_id = p_canteen_id and p.method = 'cash' and p.status = 'success'
      and ist_date(p.created_at) = d.day
  )
  select jsonb_build_object(
    'date', (select day from d),
    'payments', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from cash_log r), '[]'::jsonb),
    'total_paise', coalesce((select sum(amount_paise) from cash_log), 0)
  )
$$;

do $$
begin
  revoke execute on all functions in schema public from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on all functions in schema public from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on all functions in schema public to service_role;
  end if;
end $$;
