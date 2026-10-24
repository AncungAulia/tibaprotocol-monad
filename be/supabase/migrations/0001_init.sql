-- TIBA initial schema (tech spec section 6.1).
-- Money and status decisions live on chain; these tables only hold supporting data.
-- Addresses are stored as checksummed 0x strings exactly as the backend writes them.

create extension if not exists pgcrypto;

-- Profiles: one wallet, one role.
create table if not exists public.profiles (
  address     text primary key,
  role        text not null check (role in ('payer', 'carrier', 'investor', 'warehouse')),
  name        text,
  phone_e164  text,
  email       text,
  plate       text,
  created_at  timestamptz not null default now()
);

-- Payer company details and review state.
create table if not exists public.companies (
  payer_address     text primary key references public.profiles (address) on delete cascade,
  company_name      text not null,
  registration_no   text,
  country           text,
  province          text,
  city              text,
  street            text,
  postal_code       text,
  contact_name      text,
  contact_role      text,
  phone_e164        text,
  trips_per_month   int,
  spend_per_month   numeric,
  review_status     text not null default 'in_review'
                    check (review_status in ('in_review', 'approved', 'needs_info')),
  review_note       text,
  credit_limit      numeric,
  credit_limit_tx   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Saved pickup points and destinations.
create table if not exists public.places (
  id                uuid primary key default gen_random_uuid(),
  payer_address     text not null references public.profiles (address) on delete cascade,
  name              text not null,
  address           text not null,
  lat               double precision not null,
  lng               double precision not null,
  kind              text not null check (kind in ('pickup', 'destination')),
  receiver_address  text,             -- warehouse wallet bound to this destination
  receiver_email    text,             -- who the warehouse invite is meant for
  created_at        timestamptz not null default now()
);
create index if not exists places_payer_idx on public.places (payer_address);
create index if not exists places_receiver_idx on public.places (receiver_address);

-- Invite links for carriers and warehouse staff.
create table if not exists public.invites (
  token          text primary key,
  kind           text not null check (kind in ('carrier', 'warehouse')),
  payer_address  text not null references public.profiles (address) on delete cascade,
  label          text,
  place_id       uuid references public.places (id) on delete cascade,
  expires_at     timestamptz not null,
  used_by        text,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists invites_payer_idx on public.invites (payer_address);

-- Payer <-> carrier network.
create table if not exists public.relations (
  payer_address    text not null,
  carrier_address  text not null,
  status           text not null default 'connected',
  created_at       timestamptz not null default now(),
  primary key (payer_address, carrier_address)
);
create index if not exists relations_carrier_idx on public.relations (carrier_address);

-- Off-chain trip details, keyed by the on-chain shipment id.
create table if not exists public.trips (
  shipment_id        bigint primary key,
  payer_address      text not null,
  carrier_address    text not null,
  consignee_address  text not null,
  pickup_place       uuid references public.places (id),
  destination_place  uuid references public.places (id),
  cargo              text not null,
  route_geojson      jsonb,
  route_source       text not null default 'ors' check (route_source in ('ors', 'straight_line')),
  distance_km        numeric,
  duration_min       numeric,
  share_location     boolean not null default true,
  created_at         timestamptz not null default now()
);
create index if not exists trips_payer_idx on public.trips (payer_address);
create index if not exists trips_carrier_idx on public.trips (carrier_address);
create index if not exists trips_consignee_idx on public.trips (consignee_address);

-- Truck positions (Realtime enabled below).
create table if not exists public.locations (
  id           bigint generated always as identity primary key,
  shipment_id  bigint not null references public.trips (shipment_id) on delete cascade,
  lat          double precision not null,
  lng          double precision not null,
  recorded_at  timestamptz not null default now()
);
create index if not exists locations_shipment_time_idx on public.locations (shipment_id, recorded_at desc);

-- Warehouse problem reports.
create table if not exists public.reports (
  shipment_id       bigint primary key,
  issues            text[] not null default '{}',
  received_qty      int,
  note              text,
  reporter_address  text not null,
  created_at        timestamptz not null default now()
);

-- Realtime: payers subscribe to truck positions; trips are included for route updates.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.locations;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.trips;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- Row Level Security.
-- The backend uses the service-role key (bypasses RLS) and checks access in code.
-- The browser only uses the anon key for Realtime on `locations` and `trips`.
-- DEMO NOTE: the read policies below are intentionally permissive (no real sensitive data on
-- testnet). Before production, scope reads to the related payer / carrier / receiver using
-- wallet-bound JWT claims.
alter table public.profiles  enable row level security;
alter table public.companies enable row level security;
alter table public.places    enable row level security;
alter table public.invites   enable row level security;
alter table public.relations enable row level security;
alter table public.trips     enable row level security;
alter table public.locations enable row level security;
alter table public.reports   enable row level security;

drop policy if exists "demo read locations" on public.locations;
create policy "demo read locations" on public.locations for select to anon, authenticated using (true);

drop policy if exists "demo read trips" on public.trips;
create policy "demo read trips" on public.trips for select to anon, authenticated using (true);
-- No anon policies on other tables: they are reached only through the backend.
