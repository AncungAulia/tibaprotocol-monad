-- Verified pickup clock for client-side demo animation, and an opaque GPS topic per trip.
begin;
alter table public.trips
  add column picked_up_at timestamptz,
  add column channel_key text not null default replace(gen_random_uuid()::text, '-', '')
    constraint trips_channel_key_format check (channel_key ~ '^[0-9a-f]{32}$'),
  add constraint trips_channel_key_unique unique (channel_key);
notify pgrst, 'reload schema';
commit;
