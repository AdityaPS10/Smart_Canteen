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
