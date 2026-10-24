-- Distinguish demo route simulation from real device GPS in API responses and maps.
begin;
alter table public.locations
  add column source text not null default 'gps'
  check (source in ('gps', 'simulated'));
notify pgrst, 'reload schema';
commit;
