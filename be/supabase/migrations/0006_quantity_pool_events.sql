-- Box count for the warehouse's one-tap confirm, and investor deposits/withdrawals recorded from
-- verified receipts (the public Monad RPC limits eth_getLogs to 100 blocks, so history can't be scanned).
begin;

alter table public.trips
  add column if not exists quantity integer
    constraint trips_quantity_range check (quantity is null or quantity between 1 and 1000000);

create table if not exists public.pool_events (
  tx_hash     text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index   integer not null check (log_index >= 0),
  investor    text not null,
  kind        text not null check (kind in ('deposit', 'withdraw')),
  assets      numeric not null check (assets >= 0),
  block       bigint not null check (block >= 0),
  created_at  timestamptz not null default now(),
  primary key (tx_hash, log_index)
);
create index if not exists pool_events_investor_idx on public.pool_events (investor, block desc);

alter table public.pool_events enable row level security;
revoke all on public.pool_events from anon, authenticated;
grant all on public.pool_events to service_role;

notify pgrst, 'reload schema';
commit;
