-- Menu, stock and the live menu (spec section 9).

create or replace function list_canteens() returns setof canteens
language sql stable as $$
  select * from canteens where active order by name
$$;

-- Only active items with stock above 0 (sold-out items disappear from the app and the TV).
create or replace function live_menu(p_canteen_id uuid)
returns table (id uuid, name text, price_paise integer, ready_made boolean)
language sql stable as $$
  select m.id, m.name, m.price_paise, m.ready_made
  from menu_items m
  join canteens c on c.id = m.canteen_id and c.active
  where m.canteen_id = p_canteen_id and m.active and m.stock_count > 0
  order by m.name
$$;

create or replace function staff_menu(p_canteen_id uuid) returns setof menu_items
language sql stable as $$
  select * from menu_items where canteen_id = p_canteen_id order by name
$$;

-- Cashier adds a new dish together with its count.
create or replace function menu_add_item(
  p_canteen_id uuid, p_name text, p_price_paise integer, p_stock_count integer,
  p_ready_made boolean, p_holds_well boolean, p_prep_minutes integer
) returns menu_items
language plpgsql as $$
declare m menu_items;
begin
  insert into menu_items (canteen_id, name, price_paise, stock_count, ready_made, holds_well, prep_minutes, active)
  values (p_canteen_id, trim(p_name), p_price_paise, p_stock_count, p_ready_made, p_holds_well,
          case when p_ready_made then 0 else p_prep_minutes end, true)
  returning * into m;
  return m;
exception when unique_violation then
  raise exception using message = 'BAD_REQUEST', detail = 'A dish with this name already exists.';
end $$;

-- Cashier edits price / count / flags. NULL parameters mean "leave unchanged".
create or replace function menu_update_item(
  p_canteen_id uuid, p_id uuid,
  p_name text default null, p_price_paise integer default null, p_stock_count integer default null,
  p_ready_made boolean default null, p_holds_well boolean default null, p_prep_minutes integer default null,
  p_active boolean default null
) returns menu_items
language plpgsql as $$
declare m menu_items;
begin
  update menu_items set
    name         = coalesce(nullif(trim(p_name), ''), name),
    price_paise  = coalesce(p_price_paise, price_paise),
    stock_count  = coalesce(p_stock_count, stock_count),
    ready_made   = coalesce(p_ready_made, ready_made),
    holds_well   = coalesce(p_holds_well, holds_well),
    prep_minutes = coalesce(p_prep_minutes, prep_minutes),
    active       = coalesce(p_active, active),
    updated_at   = app_now()
  where id = p_id and canteen_id = p_canteen_id
  returning * into m;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;
  return m;
exception when unique_violation then
  raise exception using message = 'BAD_REQUEST', detail = 'A dish with this name already exists.';
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
