-- Smart Canteen Billing System: schema (spec section 13)
-- Money is integer paise. Timestamps are timestamptz (UTC). Business day = Asia/Kolkata.

create table if not exists settings (
  key   text primary key,
  value text not null
);

create table if not exists canteens (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id           uuid primary key default gen_random_uuid(),
  email        text unique,
  full_name    text not null,
  role         text not null check (role in ('student', 'food_server', 'cashier')),
  canteen_id   uuid references canteens(id),
  id_card_code text not null unique check (length(id_card_code) >= 16),
  created_at   timestamptz not null default now(),
  constraint staff_has_canteen check (role = 'student' or canteen_id is not null)
);

create table if not exists menu_items (
  id           uuid primary key default gen_random_uuid(),
  canteen_id   uuid not null references canteens(id),
  name         text not null check (length(trim(name)) > 0),
  price_paise  integer not null check (price_paise > 0),
  stock_count  integer not null default 0 check (stock_count >= 0),
  ready_made   boolean not null default false,
  holds_well   boolean not null default false,
  prep_minutes integer not null default 0 check (prep_minutes >= 0 and prep_minutes <= 240),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists menu_items_canteen_name_uq on menu_items (canteen_id, lower(name));
create index if not exists menu_items_live_idx on menu_items (canteen_id) where active and stock_count > 0;

create table if not exists entrance_codes (
  id         uuid primary key,
  canteen_id uuid not null references canteens(id),
  token      text not null,
  use_count  integer not null default 0 check (use_count >= 0),
  max_uses   integer not null check (max_uses > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint use_count_cap check (use_count <= max_uses),
  constraint expires_after_create check (expires_at > created_at)
);
create index if not exists entrance_codes_canteen_idx on entrance_codes (canteen_id, created_at desc);

create table if not exists checkins (
  id                uuid primary key default gen_random_uuid(),
  canteen_id        uuid not null references canteens(id),
  student_id        uuid not null references profiles(id),
  entrance_code_id  uuid not null references entrance_codes(id),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  constraint checkin_expires_after_create check (expires_at > created_at)
);
create index if not exists checkins_student_idx on checkins (student_id, canteen_id, expires_at desc);

create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  canteen_id        uuid not null references canteens(id),
  student_id        uuid references profiles(id),
  source            text not null check (source in ('app', 'cashier')),
  customer_name     text,
  token_number      integer check (token_number > 0),
  service_date      date not null,
  status            text not null default 'PENDING_PAYMENT' check (status in
                      ('PENDING_PAYMENT', 'PAYMENT_FAILED', 'PAID', 'PREPARING', 'READY', 'GIVEN', 'EXPIRED')),
  total_paise       integer not null check (total_paise >= 0),
  payment_attempts  integer not null default 0 check (payment_attempts >= 0),
  estimated_minutes integer check (estimated_minutes >= 0),
  estimate_source   text check (estimate_source in ('formula', 'ml', 'ml_sample')),
  client_request_id uuid,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  ready_at          timestamptz,
  given_at          timestamptz,
  expired_at        timestamptz,
  constraint orders_token_uq unique (canteen_id, service_date, token_number),
  constraint orders_client_request_uq unique (student_id, client_request_id),
  -- A token exists if and only if the order has been paid.
  constraint token_only_when_paid check (
    (status in ('PENDING_PAYMENT', 'PAYMENT_FAILED')) = (token_number is null)
  ),
  constraint app_orders_have_student check (source = 'cashier' or student_id is not null)
);
create index if not exists orders_canteen_status_idx on orders (canteen_id, status);
create index if not exists orders_student_idx on orders (student_id, created_at desc);
create index if not exists orders_paid_at_idx on orders (canteen_id, paid_at);

create table if not exists order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  menu_item_id       uuid not null references menu_items(id),
  name_snapshot      text not null,
  unit_price_paise   integer not null check (unit_price_paise >= 0),
  quantity           integer not null check (quantity > 0),
  status             text not null default 'pending' check (status in ('pending', 'preparing', 'ready')),
  ready_at           timestamptz,
  disposition        text check (disposition in ('spare_pool', 'wasted')),
  disposition_due_at timestamptz
);
create index if not exists order_items_order_idx on order_items (order_id);
create index if not exists order_items_menu_idx on order_items (menu_item_id);
create index if not exists order_items_disposition_due_idx on order_items (disposition_due_at)
  where disposition is null and disposition_due_at is not null;

create table if not exists payments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  method             text not null check (method in ('upi', 'cash')),
  status             text not null check (status in ('created', 'success', 'failed', 'late_success', 'amount_mismatch')),
  gateway_order_id   text unique,
  gateway_payment_id text unique,
  attempt_no         integer not null check (attempt_no > 0),
  amount_paise       integer not null check (amount_paise >= 0),
  cashier_id         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint cash_has_cashier check ((method = 'cash') = (cashier_id is not null)),
  constraint payments_attempt_uq unique (order_id, attempt_no)
);
create index if not exists payments_order_idx on payments (order_id);
create index if not exists payments_cash_idx on payments (created_at desc) where method = 'cash';

create table if not exists order_events (
  id        bigint generated always as identity primary key,
  order_id  uuid not null references orders(id) on delete cascade,
  event     text not null,
  at        timestamptz not null default now(),
  is_sample boolean not null default false,
  meta      jsonb
);
create index if not exists order_events_order_idx on order_events (order_id, event);
create index if not exists order_events_event_idx on order_events (event, is_sample);

create table if not exists spare_pool (
  id            uuid primary key default gen_random_uuid(),
  canteen_id    uuid not null references canteens(id),
  menu_item_id  uuid not null references menu_items(id),
  quantity      integer not null check (quantity > 0),
  added_at      timestamptz not null default now(),
  order_item_id uuid unique references order_items(id)
);
create index if not exists spare_pool_canteen_idx on spare_pool (canteen_id, added_at desc);

create table if not exists wasted_items (
  id            uuid primary key default gen_random_uuid(),
  canteen_id    uuid not null references canteens(id),
  menu_item_id  uuid not null references menu_items(id),
  quantity      integer not null check (quantity > 0),
  value_paise   integer not null check (value_paise >= 0),
  at            timestamptz not null default now(),
  order_item_id uuid unique references order_items(id)
);
create index if not exists wasted_items_canteen_idx on wasted_items (canteen_id, at desc);

create table if not exists token_counters (
  canteen_id   uuid not null references canteens(id),
  service_date date not null,
  last_token   integer not null check (last_token >= 0),
  primary key (canteen_id, service_date)
);

insert into settings (key, value) values
  ('qr_ttl_seconds', '60'),
  ('qr_max_uses', '10'),
  ('qr_grace_seconds', '5'),
  ('checkin_minutes', '10'),
  ('grouping_window_minutes', '5'),
  ('arrival_window_minutes', '10'),
  ('post_expiry_wait_minutes', '10'),
  ('spare_pool_extra_wait_minutes', '5'),
  ('payment_max_retries', '2'),
  ('payment_timeout_minutes', '3'),
  ('kitchen_staff_count', '2'),
  ('ml_min_samples', '50'),
  ('ml_retrain_every_orders', '20'),
  ('ml_trained_ready_count', '0')
on conflict (key) do nothing;

-- Lock everything down: the browser never talks to the database directly.
-- Only the service role (used by Next.js route handlers) can read/write.
do $$
declare t text;
begin
  foreach t in array array['settings','canteens','profiles','menu_items','entrance_codes','checkins','orders',
                           'order_items','payments','order_events','spare_pool','wasted_items','token_counters']
  loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table %I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on table %I from authenticated', t);
    end if;
  end loop;
end $$;
