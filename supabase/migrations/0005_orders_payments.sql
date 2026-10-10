-- Ordering, stock reservation, payments, token and bill (spec sections 5, 7, 9, 17).

-- Prices a cart from the database (never from the client). Read-only.
create or replace function preview_cart(p_canteen_id uuid, p_items jsonb) returns jsonb
language plpgsql stable as $$
declare
  r record;
  m menu_items;
  v_lines jsonb := '[]'::jsonb;
  v_total integer := 0;
begin
  for r in
    select (e->>'menu_item_id')::uuid as id, sum((e->>'quantity')::integer)::integer as q
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
    group by 1 order by 1
  loop
    if r.q is null or r.q <= 0 then
      raise exception using message = 'BAD_REQUEST', detail = 'Quantities must be positive.';
    end if;
    select * into m from menu_items where id = r.id and canteen_id = p_canteen_id;
    if not found or not m.active then
      raise exception using message = 'ITEM_UNAVAILABLE', detail = coalesce(m.name, 'An item');
    end if;
    if m.stock_count < r.q then
      raise exception using message = 'SOLD_OUT', detail = m.name;
    end if;
    v_lines := v_lines || jsonb_build_object('menu_item_id', m.id, 'name', m.name, 'unit_price_paise', m.price_paise,
                                             'quantity', r.q, 'line_total_paise', m.price_paise * r.q);
    v_total := v_total + m.price_paise * r.q;
  end loop;
  if jsonb_array_length(v_lines) = 0 then
    raise exception using message = 'EMPTY_CART';
  end if;
  return jsonb_build_object('lines', v_lines, 'total_paise', v_total);
end $$;

-- Reserves stock for every line with ONE conditional UPDATE each (stock_count >= quantity),
-- inserts the order items with price snapshots and sets the server-calculated total.
-- Any failure raises, which rolls back the whole order.
create or replace function _reserve_items(p_order_id uuid, p_canteen_id uuid, p_items jsonb) returns integer
language plpgsql as $$
declare
  r record;
  v_name text;
  v_price integer;
  v_active boolean;
  v_total integer := 0;
  v_count integer := 0;
begin
  for r in
    select (e->>'menu_item_id')::uuid as id, sum((e->>'quantity')::integer)::integer as q
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
    group by 1 order by 1  -- fixed lock order avoids deadlocks between concurrent orders
  loop
    if r.q is null or r.q <= 0 then
      raise exception using message = 'BAD_REQUEST', detail = 'Quantities must be positive.';
    end if;

    update menu_items
       set stock_count = stock_count - r.q, updated_at = app_now()
     where id = r.id and canteen_id = p_canteen_id and active and stock_count >= r.q
    returning name, price_paise into v_name, v_price;

    if not found then
      select name, active into v_name, v_active from menu_items where id = r.id and canteen_id = p_canteen_id;
      if v_name is null or not v_active then
        raise exception using message = 'ITEM_UNAVAILABLE', detail = coalesce(v_name, 'An item');
      end if;
      raise exception using message = 'SOLD_OUT', detail = v_name;
    end if;

    insert into order_items (order_id, menu_item_id, name_snapshot, unit_price_paise, quantity)
    values (p_order_id, r.id, v_name, v_price, r.q);
    v_total := v_total + v_price * r.q;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception using message = 'EMPTY_CART';
  end if;
  update orders set total_paise = v_total where id = p_order_id;
  return v_total;
end $$;

create or replace function _release_stock(p_order_id uuid) returns void
language sql as $$
  update menu_items m
     set stock_count = m.stock_count + x.q, updated_at = app_now()
    from (select menu_item_id, sum(quantity)::integer as q from order_items where order_id = p_order_id group by 1) x
   where m.id = x.menu_item_id
$$;

-- Marks the order PAID (token assigned inside transition_order), gives ready_made items instantly,
-- and makes the order READY at once if every item is ready_made.
create or replace function _finalize_paid(p_order_id uuid, p_meta jsonb default null) returns orders
language plpgsql as $$
declare o orders;
begin
  o := transition_order(p_order_id, 'PAID', p_meta);
  update order_items oi set status = 'ready', ready_at = app_now()
    from menu_items m
   where m.id = oi.menu_item_id and oi.order_id = p_order_id and m.ready_made;
  if not exists (select 1 from order_items where order_id = p_order_id and status <> 'ready') then
    o := transition_order(p_order_id, 'READY');
  end if;
  return o;
end $$;

create or replace function _fail_order(p_order_id uuid, p_reason text) returns orders
language plpgsql as $$
declare o orders;
begin
  o := transition_order(p_order_id, 'PAYMENT_FAILED', jsonb_build_object('reason', p_reason));
  perform _release_stock(p_order_id);
  return o;
end $$;

-- Student order: requires an active entrance check-in (verified here, on the server).
-- Idempotent per (student, client_request_id) so a double-clicked Pay creates one order.
create or replace function place_order(p_canteen_id uuid, p_student_id uuid, p_items jsonb, p_client_request_id uuid)
returns jsonb
language plpgsql as $$
declare
  o orders;
begin
  if p_client_request_id is not null then
    select * into o from orders where student_id = p_student_id and client_request_id = p_client_request_id;
    if found then
      return jsonb_build_object('order_id', o.id, 'created', false, 'total_paise', o.total_paise, 'status', o.status);
    end if;
  end if;

  if not exists (select 1 from active_checkin(p_student_id, p_canteen_id)) then
    raise exception using message = 'NO_CHECKIN';
  end if;

  insert into orders (canteen_id, student_id, source, service_date, status, total_paise, client_request_id, created_at)
  values (p_canteen_id, p_student_id, 'app', ist_date(app_now()), 'PENDING_PAYMENT', 0, p_client_request_id, app_now())
  on conflict (student_id, client_request_id) do nothing
  returning * into o;
  if o.id is null then  -- lost a race with the same request
    select * into o from orders where student_id = p_student_id and client_request_id = p_client_request_id;
    return jsonb_build_object('order_id', o.id, 'created', false, 'total_paise', o.total_paise, 'status', o.status);
  end if;

  perform _reserve_items(o.id, p_canteen_id, p_items);
  insert into order_events (order_id, event, at) values (o.id, 'created', app_now());
  select * into o from orders where id = o.id;
  return jsonb_build_object('order_id', o.id, 'created', true, 'total_paise', o.total_paise, 'status', o.status);
end $$;

-- Read-only pre-check before asking the gateway for an order.
create or replace function can_start_payment(p_order_id uuid, p_student_id uuid) returns orders
language plpgsql stable as $$
declare o orders;
begin
  select * into o from orders where id = p_order_id and student_id = p_student_id;
  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;
  if o.status <> 'PENDING_PAYMENT' then
    raise exception using message = 'NOT_PENDING';
  end if;
  if o.payment_attempts >= setting_int('payment_max_retries') + 1 then
    raise exception using message = 'RETRY_LIMIT';
  end if;
  return o;
end $$;

-- Records one UPI payment attempt (one gateway order). At most payment_max_retries + 1 attempts.
create or replace function start_payment_attempt(p_order_id uuid, p_student_id uuid, p_gateway_order_id text)
returns payments
language plpgsql as $$
declare
  o orders;
  p payments;
begin
  select * into o from orders where id = p_order_id and student_id = p_student_id for update;
  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;
  if o.status <> 'PENDING_PAYMENT' then
    raise exception using message = 'NOT_PENDING';
  end if;
  if o.payment_attempts >= setting_int('payment_max_retries') + 1 then
    raise exception using message = 'RETRY_LIMIT';
  end if;
  update orders set payment_attempts = payment_attempts + 1 where id = o.id returning * into o;
  insert into payments (order_id, method, status, gateway_order_id, attempt_no, amount_paise, created_at, updated_at)
  values (o.id, 'upi', 'created', p_gateway_order_id, o.payment_attempts, o.total_paise, app_now(), app_now())
  returning * into p;
  insert into order_events (order_id, event, at, meta)
  values (o.id, 'payment_attempt', app_now(), jsonb_build_object('attempt', o.payment_attempts));
  return p;
end $$;

-- Payment success (webhook = source of truth; mock page uses the same function).
-- Idempotent: the same gateway_payment_id is processed once. Never creates a token for a
-- PAYMENT_FAILED order (logged as late_payment_ignored).
create or replace function confirm_payment(p_gateway_order_id text, p_gateway_payment_id text, p_amount_paise integer)
returns jsonb
language plpgsql as $$
declare
  p payments;
  o orders;
begin
  select * into p from payments where gateway_payment_id = p_gateway_payment_id;
  if found then
    return jsonb_build_object('result', 'duplicate', 'order_id', p.order_id);
  end if;

  select * into p from payments where gateway_order_id = p_gateway_order_id for update;
  if not found then
    return jsonb_build_object('result', 'unknown');
  end if;
  -- re-check after taking the lock (a concurrent delivery of the same webhook)
  if p.gateway_payment_id = p_gateway_payment_id then
    return jsonb_build_object('result', 'duplicate', 'order_id', p.order_id);
  end if;

  select * into o from orders where id = p.order_id for update;

  if o.status = 'PAYMENT_FAILED' then
    update payments set status = 'late_success', gateway_payment_id = p_gateway_payment_id, updated_at = app_now()
     where id = p.id;
    insert into order_events (order_id, event, at, meta)
    values (o.id, 'late_payment_ignored', app_now(),
            jsonb_build_object('gateway_payment_id', p_gateway_payment_id, 'amount_paise', p_amount_paise));
    return jsonb_build_object('result', 'late', 'order_id', o.id, 'status', o.status);
  end if;

  if o.status <> 'PENDING_PAYMENT' then
    -- already paid through another attempt
    update payments set status = 'late_success', gateway_payment_id = p_gateway_payment_id, updated_at = app_now()
     where id = p.id;
    insert into order_events (order_id, event, at, meta)
    values (o.id, 'duplicate_payment', app_now(), jsonb_build_object('gateway_payment_id', p_gateway_payment_id));
    return jsonb_build_object('result', 'duplicate', 'order_id', o.id, 'status', o.status);
  end if;

  if p_amount_paise is distinct from o.total_paise then
    update payments set status = 'amount_mismatch', gateway_payment_id = p_gateway_payment_id, updated_at = app_now()
     where id = p.id;
    insert into order_events (order_id, event, at, meta)
    values (o.id, 'amount_mismatch', app_now(), jsonb_build_object('expected', o.total_paise, 'got', p_amount_paise));
    return jsonb_build_object('result', 'amount_mismatch', 'order_id', o.id, 'status', o.status);
  end if;

  update payments set status = 'success', gateway_payment_id = p_gateway_payment_id, updated_at = app_now()
   where id = p.id;
  o := _finalize_paid(o.id, jsonb_build_object('method', 'upi', 'attempt', p.attempt_no));
  return jsonb_build_object('result', 'confirmed', 'order_id', o.id, 'status', o.status,
                            'token_number', o.token_number, 'canteen_id', o.canteen_id);
end $$;

-- Payment failure. After the last allowed attempt fails the order becomes PAYMENT_FAILED and stock is released.
create or replace function fail_payment(p_gateway_order_id text, p_reason text default null) returns jsonb
language plpgsql as $$
declare
  p payments;
  o orders;
  v_max integer := setting_int('payment_max_retries') + 1;
  v_failed integer;
begin
  select * into p from payments where gateway_order_id = p_gateway_order_id for update;
  if not found then
    return jsonb_build_object('result', 'unknown');
  end if;
  select * into o from orders where id = p.order_id for update;
  if p.status <> 'created' then
    return jsonb_build_object('result', 'ignored', 'order_id', o.id, 'status', o.status);
  end if;

  update payments set status = 'failed', updated_at = app_now() where id = p.id;
  insert into order_events (order_id, event, at, meta)
  values (o.id, 'payment_failed_attempt', app_now(),
          jsonb_build_object('attempt', p.attempt_no, 'reason', left(coalesce(p_reason, ''), 200)));

  if o.status = 'PENDING_PAYMENT' then
    select count(*) into v_failed from payments where order_id = o.id and status = 'failed';
    if v_failed >= v_max then
      o := _fail_order(o.id, 'retries_exhausted');
    end if;
  end if;
  return jsonb_build_object('result', 'failed', 'order_id', o.id, 'status', o.status, 'canteen_id', o.canteen_id,
                            'attempts_left', greatest(0, v_max - o.payment_attempts));
end $$;

-- Order + items + payment summary for the student / staff screens (ownership checked by the app).
create or replace function get_order(p_order_id uuid) returns jsonb
language plpgsql stable as $$
declare
  o orders;
  v_max integer := setting_int('payment_max_retries') + 1;
begin
  select * into o from orders where id = p_order_id;
  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;
  return jsonb_build_object(
    'order', to_jsonb(o) - 'client_request_id',
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', oi.id, 'name', oi.name_snapshot, 'unit_price_paise', oi.unit_price_paise,
                 'quantity', oi.quantity, 'status', oi.status) order by oi.name_snapshot)
               from order_items oi where oi.order_id = o.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
                 'attempt_no', p.attempt_no, 'method', p.method, 'status', p.status) order by p.attempt_no)
               from payments p where p.order_id = o.id), '[]'::jsonb),
    'open_gateway_order_id', (select p.gateway_order_id from payments p
                               where p.order_id = o.id and p.status = 'created' and p.method = 'upi'
                               order by p.attempt_no desc limit 1),
    'attempts_left', greatest(0, v_max - o.payment_attempts)
  );
end $$;

-- The student's current order today (for the Home link).
create or replace function active_order_for_student(p_student_id uuid) returns setof orders
language sql stable as $$
  select * from orders
  where student_id = p_student_id
    and status in ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY')
    and created_at > app_now() - interval '1 day'
  order by created_at desc
  limit 1
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
