-- Demo seed data (spec section 19). Safe to run more than once.

insert into canteens (id, name, active) values
  ('00000000-0000-4000-8000-000000000001', 'Main canteen', true)
on conflict (id) do nothing;

-- BEGIN demo profiles (scripts/seed-qr.mjs reads this block to draw ID-card QR PNGs)
insert into profiles (id, email, full_name, role, canteen_id, id_card_code) values
  ('00000000-0000-4000-8000-000000000101', 'student1@mycollege.edu', 'Demo Student One', 'student',     null,                                   '20747f7adc042440674093ae'),
  ('00000000-0000-4000-8000-000000000102', 'student2@mycollege.edu', 'Demo Student Two', 'student',     null,                                   '16d39580920fffd83d6ecc74'),
  ('00000000-0000-4000-8000-000000000201', 'server1@mycollege.edu',  'Demo Food Server', 'food_server', '00000000-0000-4000-8000-000000000001', 'f4548e71612d0abb598d72b1'),
  ('00000000-0000-4000-8000-000000000301', 'cashier1@mycollege.edu', 'Demo Cashier',     'cashier',     '00000000-0000-4000-8000-000000000001', '39b2ca9d51f1ea51257887c4')
on conflict (id) do nothing;
-- END demo profiles

insert into menu_items (id, canteen_id, name, price_paise, stock_count, ready_made, holds_well, prep_minutes, active) values
  ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000001', 'Samosa',         1500, 40, false, true,  3, true),
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000001', 'Veg puff',       2000, 30, true,  true,  0, true),
  ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000001', 'Vada',           1200, 40, false, true,  3, true),
  ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000001', 'Masala dosa',    5000, 25, false, false, 6, true),
  ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000001', 'Plain dosa',     4000, 25, false, false, 5, true),
  ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000001', 'Idli (2 pcs)',   3000, 30, false, false, 4, true),
  ('00000000-0000-4000-8000-000000001007', '00000000-0000-4000-8000-000000000001', 'Tea',            1000, 60, false, false, 2, true),
  ('00000000-0000-4000-8000-000000001008', '00000000-0000-4000-8000-000000000001', 'Coffee',         1500, 60, false, false, 2, true),
  ('00000000-0000-4000-8000-000000001009', '00000000-0000-4000-8000-000000000001', 'Biscuit packet', 1000, 50, true,  true,  0, true),
  ('00000000-0000-4000-8000-000000001010', '00000000-0000-4000-8000-000000000001', 'Juice',          2500, 30, true,  false, 0, true),
  ('00000000-0000-4000-8000-000000001011', '00000000-0000-4000-8000-000000000001', 'Veg sandwich',   3500, 20, false, false, 4, true),
  ('00000000-0000-4000-8000-000000001012', '00000000-0000-4000-8000-000000000001', 'Lemon rice',     4000, 20, false, true,  2, true)
on conflict (id) do nothing;

-- BEGIN sample history
-- 300 synthetic past orders (previous 14 days) for the time-prediction model. Every event is marked
-- is_sample = true; the app labels estimates "estimate (sample data)" while these dominate training.
do $$
declare
  c uuid := '00000000-0000-4000-8000-000000000001';
  i integer;
  d date;
  h integer;
  paid timestamptz;
  ready timestamptz;
  units_ahead integer;
  items integer;
  max_prep integer;
  minutes numeric;
  tok integer;
  v_order uuid;
begin
  if exists (select 1 from order_events where is_sample) then
    return;
  end if;
  perform setseed(0.42);
  for i in 1..300 loop
    d := ist_date(now()) - (1 + i % 14);
    h := (array[8, 9, 10, 11, 12, 12, 13, 13, 13, 14, 16, 17])[1 + floor(random() * 12)::integer];
    paid := ((d + make_time(h, floor(random() * 60)::integer, floor(random() * 60)::integer))
             at time zone 'Asia/Kolkata');
    units_ahead := floor(random() * (case when h in (12, 13) then 24 else 8 end))::integer;
    items := 1 + floor(random() * 4)::integer;
    max_prep := (array[0, 2, 2, 3, 3, 4, 5, 6])[1 + floor(random() * 8)::integer];
    minutes := case when max_prep = 0 then 0
                    else greatest(1, max_prep + units_ahead * 3.2 / 2 * 0.7 + items * 0.4
                                     + (case when h in (12, 13) then 2 else 0 end) + (random() - 0.5) * 4) end;
    ready := paid + make_interval(secs => (minutes * 60)::double precision);

    insert into token_counters as tc (canteen_id, service_date, last_token) values (c, d, 1)
    on conflict (canteen_id, service_date) do update set last_token = tc.last_token + 1
    returning last_token into tok;

    insert into orders (canteen_id, source, customer_name, token_number, service_date, status, total_paise,
                        payment_attempts, created_at, paid_at, ready_at, given_at)
    values (c, 'cashier', 'sample', tok, d, 'GIVEN', 1000 * items + 500 * max_prep, 1,
            paid - interval '1 minute', paid, ready, ready + interval '2 minutes')
    returning id into v_order;

    insert into order_events (order_id, event, at, is_sample, meta) values
      (v_order, 'paid', paid, true, jsonb_build_object('features', jsonb_build_object(
          'hour', h, 'weekday', extract(isodow from d)::integer, 'units_ahead', units_ahead,
          'items_count', items, 'max_prep_minutes', max_prep, 'prep_minutes_ahead', units_ahead * 3,
          'all_ready_made', max_prep = 0))),
      (v_order, 'ready', ready, true, null),
      (v_order, 'given', ready + interval '2 minutes', true, null);
  end loop;
end $$;
-- END sample history
