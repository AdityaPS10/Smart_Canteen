-- Scheduled work (spec section 11): READY -> EXPIRED, the two waiting stages, spare pool / wasted,
-- PENDING_PAYMENT timeouts. Idempotent and safe to run twice (every step is conditional on current state,
-- rows are locked with SKIP LOCKED so two concurrent runs never process the same row).

create or replace function process_tick() returns jsonb
language plpgsql as $$
declare
  v_now timestamptz := app_now();
  v_timeout interval := make_interval(mins => setting_int('payment_timeout_minutes'));
  v_arrival interval := make_interval(mins => setting_int('arrival_window_minutes'));
  v_post_wait interval := make_interval(mins => setting_int('post_expiry_wait_minutes'));
  v_extra_wait interval := make_interval(mins => setting_int('spare_pool_extra_wait_minutes'));
  r record;
  o orders;
  v_failed uuid[] := '{}';
  v_expired uuid[] := '{}';
  v_canteens uuid[] := '{}';
  v_spare integer := 0;
  v_wasted integer := 0;
  v_extended integer := 0;
  v_completed integer;
  v_trained integer;
begin
  -- 1. No payment within payment_timeout_minutes (since the latest attempt): PAYMENT_FAILED + release stock.
  for r in
    select o2.id, o2.canteen_id from orders o2
    where o2.status = 'PENDING_PAYMENT'
      and greatest(o2.created_at, coalesce((select max(p.created_at) from payments p where p.order_id = o2.id), o2.created_at))
          + v_timeout <= v_now
    order by o2.id
    for update skip locked
  loop
    update payments set status = 'failed', updated_at = v_now where order_id = r.id and status = 'created';
    perform _fail_order(r.id, 'payment_timeout');
    v_failed := v_failed || r.id;
    v_canteens := v_canteens || r.canteen_id;
  end loop;

  -- 2. Not collected within arrival_window_minutes of READY: EXPIRED, then "wait 10 minutes" starts.
  for r in
    select o2.id, o2.canteen_id from orders o2
    where o2.status = 'READY' and o2.ready_at + v_arrival <= v_now
    order by o2.id
    for update skip locked
  loop
    o := transition_order(r.id, 'EXPIRED');
    update order_items set disposition_due_at = o.expired_at + v_post_wait
     where order_id = r.id and disposition is null;
    v_expired := v_expired || r.id;
    v_canteens := v_canteens || r.canteen_id;
  end loop;

  -- 3. After the wait: "Holds well?"
  --    YES: wait spare_pool_extra_wait_minutes more (stage 2), then add to the spare pool.
  --    NO:  wasted (item, quantity, value, time).
  for r in
    select oi.id, oi.menu_item_id, oi.quantity, oi.unit_price_paise, oi.disposition_due_at,
           o2.canteen_id, o2.expired_at, m.holds_well
    from order_items oi
    join orders o2 on o2.id = oi.order_id
    join menu_items m on m.id = oi.menu_item_id
    where o2.status = 'EXPIRED' and oi.disposition is null
      and oi.disposition_due_at is not null and oi.disposition_due_at <= v_now
    order by oi.id
    for update of oi skip locked
  loop
    if r.holds_well and r.disposition_due_at <= r.expired_at + v_post_wait then
      -- first stage just ended: wait some more time
      update order_items set disposition_due_at = r.disposition_due_at + v_extra_wait where id = r.id;
      v_extended := v_extended + 1;
    elsif r.holds_well then
      insert into spare_pool (canteen_id, menu_item_id, quantity, added_at, order_item_id)
      values (r.canteen_id, r.menu_item_id, r.quantity, v_now, r.id)
      on conflict (order_item_id) do nothing;
      update order_items set disposition = 'spare_pool' where id = r.id;
      v_spare := v_spare + 1;
      v_canteens := v_canteens || r.canteen_id;
    else
      insert into wasted_items (canteen_id, menu_item_id, quantity, value_paise, at, order_item_id)
      values (r.canteen_id, r.menu_item_id, r.quantity, r.unit_price_paise * r.quantity, v_now, r.id)
      on conflict (order_item_id) do nothing;
      update order_items set disposition = 'wasted' where id = r.id;
      v_wasted := v_wasted + 1;
      v_canteens := v_canteens || r.canteen_id;
    end if;
  end loop;

  -- 4. Is an ML retrain due? (every ml_retrain_every_orders newly completed real orders)
  select count(*) into v_completed from orders o2
  where o2.ready_at is not null and o2.paid_at is not null
    and not exists (select 1 from order_events e where e.order_id = o2.id and e.is_sample);
  v_trained := setting_int('ml_trained_ready_count');

  return jsonb_build_object(
    'payment_timeouts', to_jsonb(v_failed),
    'expired', to_jsonb(v_expired),
    'extended', v_extended,
    'spare_pool', v_spare,
    'wasted', v_wasted,
    'canteen_ids', to_jsonb(array(select distinct unnest(v_canteens))),
    'completed_orders', v_completed,
    'retrain_due', v_completed - v_trained >= setting_int('ml_retrain_every_orders')
  );
end $$;

-- Called by the app after the ML service retrained successfully.
create or replace function mark_ml_trained(p_completed_count integer) returns void
language sql as $$
  update settings set value = p_completed_count::text where key = 'ml_trained_ready_count'
$$;

-- pg_cron: run the tick every minute when the extension is available (Supabase: enable "pg_cron").
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      execute 'create extension if not exists pg_cron';
      execute $cron$select cron.unschedule(jobid) from cron.job where jobname = 'canteen_tick'$cron$;
      execute $cron$select cron.schedule('canteen_tick', '* * * * *', 'select public.process_tick()')$cron$;
    exception when others then
      raise notice 'pg_cron not scheduled (%). Use POST /api/cron/tick instead.', sqlerrm;
    end;
  end if;
end $$;

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
