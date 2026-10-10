-- Kitchen display, food-server screen and TV board (spec sections 4, 5, 8).

-- Items still to cook: orders PAID or PREPARING, item not ready yet.
create or replace function kitchen_items(p_canteen_id uuid)
returns table (
  order_item_id uuid, order_id uuid, token_number integer, menu_item_id uuid, name text,
  quantity integer, status text, ready_made boolean, prep_minutes integer, paid_at timestamptz
)
language sql stable as $$
  select oi.id, o.id, o.token_number, oi.menu_item_id, oi.name_snapshot, oi.quantity, oi.status,
         m.ready_made, m.prep_minutes, o.paid_at
  from order_items oi
  join orders o on o.id = oi.order_id
  join menu_items m on m.id = oi.menu_item_id
  where o.canteen_id = p_canteen_id and o.status in ('PAID', 'PREPARING') and oi.status <> 'ready'
  order by o.paid_at, o.token_number, oi.id
$$;

-- "Start cooking": the given items become preparing and their orders PREPARING.
-- Batching is only a view: each order keeps its own status.
create or replace function start_batch(p_canteen_id uuid, p_order_item_ids uuid[]) returns jsonb
language plpgsql as $$
declare
  r record;
  v_orders uuid[] := '{}';
begin
  -- lock the affected orders in a fixed order
  for r in
    select o.id, o.status from orders o
    where o.id in (select order_id from order_items where id = any(p_order_item_ids))
      and o.canteen_id = p_canteen_id and o.status in ('PAID', 'PREPARING')
    order by o.id
    for update
  loop
    update order_items set status = 'preparing'
     where order_id = r.id and id = any(p_order_item_ids) and status = 'pending';
    if found then
      v_orders := v_orders || r.id;
      if r.status = 'PAID' then
        perform transition_order(r.id, 'PREPARING');
      end if;
    end if;
  end loop;
  return jsonb_build_object('order_ids', to_jsonb(v_orders));
end $$;

-- "Mark ready": the given items become ready; an order becomes READY when all its items are ready.
create or replace function mark_batch_ready(p_canteen_id uuid, p_order_item_ids uuid[]) returns jsonb
language plpgsql as $$
declare
  r record;
  v_orders uuid[] := '{}';
  v_ready uuid[] := '{}';
begin
  for r in
    select o.id, o.status from orders o
    where o.id in (select order_id from order_items where id = any(p_order_item_ids))
      and o.canteen_id = p_canteen_id and o.status in ('PAID', 'PREPARING')
    order by o.id
    for update
  loop
    update order_items set status = 'ready', ready_at = app_now()
     where order_id = r.id and id = any(p_order_item_ids) and status <> 'ready';
    if not found then
      continue;
    end if;
    v_orders := v_orders || r.id;
    if r.status = 'PAID' then
      perform transition_order(r.id, 'PREPARING');
    end if;
    if not exists (select 1 from order_items where order_id = r.id and status <> 'ready') then
      perform transition_order(r.id, 'READY');
      v_ready := v_ready || r.id;
    end if;
  end loop;
  return jsonb_build_object('order_ids', to_jsonb(v_orders), 'ready_order_ids', to_jsonb(v_ready));
end $$;

-- Food server presses "Marked as done": READY -> GIVEN (transition_order rejects anything else).
create or replace function mark_given(p_canteen_id uuid, p_order_id uuid) returns orders
language plpgsql as $$
begin
  perform 1 from orders where id = p_order_id and canteen_id = p_canteen_id;
  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;
  return transition_order(p_order_id, 'GIVEN');
end $$;

-- Food-server table: TOKEN ID | Items | Qty | Marked as done
create or replace function counter_orders(p_canteen_id uuid) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(x order by x.sort_ready, x.paid_at, x.token_number), '[]'::jsonb) from (
    select o.id, o.token_number, o.status, o.paid_at, o.ready_at, o.source,
           case when o.status = 'READY' then 0 else 1 end as sort_ready,
           (select jsonb_agg(jsonb_build_object('name', oi.name_snapshot, 'quantity', oi.quantity, 'status', oi.status)
                             order by oi.name_snapshot)
              from order_items oi where oi.order_id = o.id) as items
    from orders o
    where o.canteen_id = p_canteen_id and o.status in ('PAID', 'PREPARING', 'READY')
  ) x
$$;

-- TV board: token numbers only (no personal data).
create or replace function tv_board(p_canteen_id uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'in_queue', coalesce((select jsonb_agg(token_number order by paid_at, token_number) from orders
                          where canteen_id = p_canteen_id and status in ('PAID', 'PREPARING')), '[]'::jsonb),
    'ready',    coalesce((select jsonb_agg(token_number order by ready_at, token_number) from orders
                          where canteen_id = p_canteen_id and status = 'READY'), '[]'::jsonb)
  )
$$;

-- Current spare pool (shown on the kitchen display).
create or replace function spare_pool_summary(p_canteen_id uuid)
returns table (menu_item_id uuid, name text, quantity bigint, last_added_at timestamptz)
language sql stable as $$
  select s.menu_item_id, m.name, sum(s.quantity), max(s.added_at)
  from spare_pool s join menu_items m on m.id = s.menu_item_id
  where s.canteen_id = p_canteen_id
  group by s.menu_item_id, m.name
  order by m.name
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
