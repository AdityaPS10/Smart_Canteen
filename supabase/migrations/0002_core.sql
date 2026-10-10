-- Core helpers and the single order-status transition function (spec section 7).

-- Current time. Equals now() in production; tests may set `app.now` for time travel.
create or replace function app_now() returns timestamptz
language sql stable as $$
  select coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now())
$$;

create or replace function ist_date(p_at timestamptz) returns date
language sql immutable as $$
  select (p_at at time zone 'Asia/Kolkata')::date
$$;

create or replace function setting_int(p_key text) returns integer
language plpgsql stable as $$
declare v text;
begin
  select value into v from settings where key = p_key;
  if v is null then
    raise exception using message = 'MISSING_SETTING', detail = p_key;
  end if;
  return v::integer;
end $$;

-- The ONLY place where orders.status changes. Rejects illegal transitions, sets the matching
-- timestamp, assigns the token when the order becomes PAID, and writes order_events.
create or replace function transition_order(p_order_id uuid, p_to text, p_meta jsonb default null)
returns orders
language plpgsql as $$
declare
  o orders;
  v_ok boolean;
  v_now timestamptz := app_now();
  v_date date;
  v_token integer;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  v_ok := case o.status
    when 'PENDING_PAYMENT' then p_to in ('PAID', 'PAYMENT_FAILED')
    when 'PAID'            then p_to in ('PREPARING', 'READY')
    when 'PREPARING'       then p_to = 'READY'
    when 'READY'           then p_to in ('GIVEN', 'EXPIRED')
    else false
  end;
  if not v_ok then
    raise exception using message = 'ILLEGAL_TRANSITION', detail = o.status || ' -> ' || coalesce(p_to, 'null');
  end if;

  -- PAID -> READY directly is only allowed when every item is ready_made.
  if o.status = 'PAID' and p_to = 'READY' and exists (
      select 1 from order_items oi join menu_items m on m.id = oi.menu_item_id
      where oi.order_id = o.id and not m.ready_made) then
    raise exception using message = 'ILLEGAL_TRANSITION', detail = 'PAID -> READY needs all items ready_made';
  end if;

  if p_to = 'PAID' then
    -- Token numbers are per canteen per (Asia/Kolkata) day, assigned atomically on payment.
    v_date := ist_date(v_now);
    insert into token_counters as tc (canteen_id, service_date, last_token)
    values (o.canteen_id, v_date, 1)
    on conflict (canteen_id, service_date) do update set last_token = tc.last_token + 1
    returning last_token into v_token;

    update orders set status = 'PAID', paid_at = v_now, service_date = v_date, token_number = v_token
    where id = o.id returning * into o;
  else
    update orders set
      status     = p_to,
      ready_at   = case when p_to = 'READY'   then v_now else ready_at end,
      given_at   = case when p_to = 'GIVEN'   then v_now else given_at end,
      expired_at = case when p_to = 'EXPIRED' then v_now else expired_at end
    where id = o.id returning * into o;
  end if;

  insert into order_events (order_id, event, at, meta) values (o.id, lower(p_to), v_now, p_meta);
  return o;
end $$;

-- Login helpers -------------------------------------------------------------------------------

create or replace function profile_by_id_card(p_code text) returns setof profiles
language sql stable as $$
  select * from profiles where id_card_code = p_code
$$;

-- Google login: returns the existing profile for this email, or creates a student.
-- The college-domain check happens in the app before this is called.
create or replace function get_or_create_google_profile(p_email text, p_name text) returns profiles
language plpgsql as $$
declare p profiles;
begin
  select * into p from profiles where lower(email) = lower(p_email);
  if found then
    return p;
  end if;
  insert into profiles (email, full_name, role, id_card_code)
  values (lower(p_email), coalesce(nullif(trim(p_name), ''), split_part(p_email, '@', 1)), 'student',
          replace(gen_random_uuid()::text, '-', ''))
  on conflict (email) do nothing
  returning * into p;
  if p.id is null then
    select * into p from profiles where lower(email) = lower(p_email);
  end if;
  return p;
end $$;

create or replace function demo_profile(p_role text) returns setof profiles
language sql stable as $$
  select * from profiles where role = p_role order by created_at, full_name limit 1
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
