-- Rotating entrance QR and check-ins (spec section 10).

create or replace function settings_json() returns jsonb
language sql stable as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from settings
$$;

-- The code currently shown at the entrance: not expired and not used up.
create or replace function current_entrance_code(p_canteen_id uuid) returns setof entrance_codes
language sql stable as $$
  select * from entrance_codes
  where canteen_id = p_canteen_id and expires_at > app_now() and use_count < max_uses
  order by created_at desc
  limit 1
$$;

-- Stores a new code (signed by the app) unless a valid one already exists. Serialized per canteen
-- so two displays refreshing at once cannot create two codes.
create or replace function rotate_entrance_code(p_canteen_id uuid, p_code_id uuid, p_token text)
returns entrance_codes
language plpgsql as $$
declare c entrance_codes;
begin
  perform 1 from canteens where id = p_canteen_id and active for update;
  if not found then
    raise exception using message = 'NOT_FOUND';
  end if;
  select * into c from current_entrance_code(p_canteen_id);
  if c.id is not null then
    return c;
  end if;
  insert into entrance_codes (id, canteen_id, token, use_count, max_uses, created_at, expires_at)
  values (p_code_id, p_canteen_id, p_token, 0, setting_int('qr_max_uses'), app_now(),
          app_now() + make_interval(secs => setting_int('qr_ttl_seconds')))
  returning * into c;
  return c;
end $$;

create or replace function active_checkin(p_student_id uuid, p_canteen_id uuid) returns setof checkins
language sql stable as $$
  select * from checkins
  where student_id = p_student_id and canteen_id = p_canteen_id and expires_at > app_now()
  order by expires_at desc
  limit 1
$$;

-- Called after the app has verified the JWT signature. Checks canteen and expiry (with grace),
-- then takes one use only if use_count < max_uses, in one statement. An active check-in is reused
-- without taking another use.
create or replace function validate_entrance_scan(p_canteen_id uuid, p_code_id uuid, p_student_id uuid)
returns jsonb
language plpgsql as $$
declare
  c entrance_codes;
  ck checkins;
  v_now timestamptz := app_now();
begin
  select * into c from entrance_codes where id = p_code_id;
  if not found then
    raise exception using message = 'QR_INVALID';
  end if;
  if c.canteen_id <> p_canteen_id then
    raise exception using message = 'QR_WRONG_CANTEEN';
  end if;

  select * into ck from active_checkin(p_student_id, p_canteen_id);
  if ck.id is not null then
    return jsonb_build_object('checkin_id', ck.id, 'canteen_id', ck.canteen_id, 'expires_at', ck.expires_at,
                              'reused', true, 'code_used_up', false);
  end if;

  if v_now > c.expires_at + make_interval(secs => setting_int('qr_grace_seconds')) then
    raise exception using message = 'QR_EXPIRED';
  end if;

  update entrance_codes set use_count = use_count + 1
  where id = p_code_id and use_count < max_uses
  returning * into c;
  if not found then
    raise exception using message = 'QR_USED_UP';
  end if;

  insert into checkins (canteen_id, student_id, entrance_code_id, created_at, expires_at)
  values (p_canteen_id, p_student_id, c.id, v_now, v_now + make_interval(mins => setting_int('checkin_minutes')))
  returning * into ck;

  return jsonb_build_object('checkin_id', ck.id, 'canteen_id', ck.canteen_id, 'expires_at', ck.expires_at,
                            'reused', false, 'code_used_up', c.use_count >= c.max_uses);
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
