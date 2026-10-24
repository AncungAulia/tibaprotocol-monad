-- One MON top-up per email wallet (be/src/lib/gas.ts). The primary key stops double sends.
create table if not exists public.gas_topups (
  address     text primary key,
  amount_wei  text not null,
  tx_hash     text,
  created_at  timestamptz not null default now()
);

alter table public.gas_topups enable row level security;
