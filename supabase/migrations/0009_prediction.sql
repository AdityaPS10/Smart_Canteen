-- Time prediction (spec section 12).
-- Features are computed when the token is created and stored on the 'paid' order event, so training
-- later uses exactly what was known at payment time. Target = minutes from paid_at to ready_at.

-- Seconds from paid_at until the end of its grouping window (Asia/Kolkata aligned), as minutes.
create or replace function _window_remaining_minutes(p_paid_at timestamptz, p_now timestamptz) returns numeric
language sql stable as $$
  with w as (select setting_int('grouping_window_minutes') * 60 as secs)
  select greatest(0, (
      floor((extract(epoch from p_paid_at) + 19800) / w.secs) * w.secs - 19800 + w.secs
      - extract(epoch from p_now)) / 60.0)::numeric(10, 2)
  from w
$$;

create or replace function _order_features(p_order_id uuid) returns jsonb
language plpgsql stable as $$
declare
  o orders;
  v_units_ahead integer;
  v_prep_ahead integer;
  v_items integer;
  v_max_prep integer;
  v_cooked integer;
begin
  select * into o from orders where id = p_order_id;
  -- food still to cook for orders paid before this one (ready_made counts as zero prep)
  select coalesce(sum(oi.quantity), 0), coalesce(sum(oi.quantity * m.prep_minutes), 0)
    into v_units_ahead, v_prep_ahead
  from order_items oi
  join orders x on x.id = oi.order_id
  join menu_items m on m.id = oi.menu_item_id
  where x.canteen_id = o.canteen_id and x.status in ('PAID', 'PREPARING') and x.id <> o.id
    -- paid earlier; the same instant is broken by token number (assigned atomically in payment order)
    and (x.paid_at < o.paid_at or (x.paid_at = o.paid_at and x.token_number < o.token_number))
    and oi.status <> 'ready' and not m.ready_made;

  select coalesce(sum(oi.quantity), 0),
         coalesce(max(case when m.ready_made then 0 else m.prep_minutes end), 0),
         coalesce(sum(case when m.ready_made then 0 else oi.quantity end), 0)
    into v_items, v_max_prep, v_cooked
  from order_items oi join menu_items m on m.id = oi.menu_item_id
  where oi.order_id = o.id;

  return jsonb_build_object(
    'hour', extract(hour from o.paid_at at time zone 'Asia/Kolkata')::integer,
    'weekday', extract(isodow from o.paid_at at time zone 'Asia/Kolkata')::integer,
    'units_ahead', v_units_ahead,
    'items_count', v_items,
    'max_prep_minutes', v_max_prep,
    'prep_minutes_ahead', v_prep_ahead,
    'all_ready_made', v_cooked = 0
  );
end $$;

-- Re-defined: also snapshots the prediction features on the 'paid' event.
create or replace function _finalize_paid(p_order_id uuid, p_meta jsonb default null) returns orders
language plpgsql as $$
declare o orders;
begin
  o := transition_order(p_order_id, 'PAID', p_meta);
  update order_events
     set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('features', _order_features(p_order_id))
   where order_id = p_order_id and event = 'paid';
  update order_items oi set status = 'ready', ready_at = app_now()
    from menu_items m
   where m.id = oi.menu_item_id and oi.order_id = p_order_id and m.ready_made;
  if not exists (select 1 from order_items where order_id = p_order_id and status <> 'ready') then
    o := transition_order(p_order_id, 'READY');
  end if;
  return o;
end $$;

-- Inputs for the estimate shown to the student.
create or replace function prediction_features(p_order_id uuid) returns jsonb
language plpgsql stable as $$
declare
  o orders;
  f jsonb;
begin
  select * into o from orders where id = p_order_id;
  if not found or o.paid_at is null then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;
  select meta->'features' into f from order_events where order_id = o.id and event = 'paid' order by id limit 1;
  return coalesce(f, _order_features(o.id)) || jsonb_build_object(
    'window_remaining_minutes', _window_remaining_minutes(o.paid_at, app_now()),
    'kitchen_staff_count', setting_int('kitchen_staff_count'),
    'ml_min_samples', setting_int('ml_min_samples')
  );
end $$;

create or replace function set_order_estimate(p_order_id uuid, p_minutes integer, p_source text) returns void
language sql as $$
  update orders set estimated_minutes = greatest(0, p_minutes), estimate_source = p_source where id = p_order_id
$$;

-- Training data: features at payment + minutes from paid to ready, newest first.
create or replace function ml_training_rows(p_limit integer default 5000) returns setof jsonb
language sql stable as $$
  select (p.meta->'features') || jsonb_build_object(
           'minutes', round((extract(epoch from (r.at - p.at)) / 60.0)::numeric, 2),
           'is_sample', p.is_sample)
  from order_events p
  join lateral (select at from order_events r where r.order_id = p.order_id and r.event = 'ready' order by id limit 1) r on true
  where p.event = 'paid' and p.meta ? 'features' and r.at >= p.at
  order by p.at desc
  limit p_limit
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
