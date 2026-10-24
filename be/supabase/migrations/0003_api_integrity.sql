-- Apply after 0001 and 0002. API access is authenticated by Privy in be/.
-- Frontend reads through the API; no direct anonymous trip/GPS access is needed.
begin;

drop policy if exists "demo read locations" on public.locations;
drop policy if exists "demo read trips" on public.trips;
revoke all on public.profiles, public.companies, public.places, public.invites,
  public.relations, public.trips, public.locations, public.reports, public.gas_topups
  from anon, authenticated;
grant all on public.profiles, public.companies, public.places, public.invites,
  public.relations, public.trips, public.locations, public.reports, public.gas_topups
  to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.reports alter column received_qty type bigint;
alter table public.invites add column receiver_email text;
alter table public.reports add constraint reports_quantity_range check (received_qty between 0 and 4294967295);
alter table public.reports add constraint reports_issues_allowed check (
  cardinality(issues) > 0 and issues <@ array['damaged','missing_items','wrong_goods','other']::text[]
);
alter table public.places add constraint places_coordinates check (lat between -90 and 90 and lng between -180 and 180);
alter table public.locations add constraint locations_coordinates check (lat between -90 and 90 and lng between -180 and 180);
alter table public.trips add constraint trips_shipment_range check (shipment_id between 1 and 33554431);
alter table public.trips add constraint trips_distinct_places check (pickup_place <> destination_place);
alter table public.trips add constraint trips_positive_route check (distance_km >= 0 and duration_min >= 0);
alter table public.companies add constraint companies_nonnegative check (trips_per_month >= 0 and spend_per_month >= 0 and credit_limit >= 0);
alter table public.invites add constraint invites_place_kind check ((kind = 'warehouse' and place_id is not null) or (kind = 'carrier' and place_id is null));
alter table public.invites add constraint invites_claim_consistent check ((used_by is null) = (used_at is null));
alter table public.relations add constraint relations_payer_fkey foreign key (payer_address) references public.profiles(address);
alter table public.relations add constraint relations_carrier_fkey foreign key (carrier_address) references public.profiles(address);

create or replace function public.touch_updated_at() returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger companies_updated_at before update on public.companies for each row execute function public.touch_updated_at();

-- Role immutability is enforced atomically, including two concurrent onboarding requests.
create or replace function public.save_profile(p_address text, p_role text, p_name text, p_phone text, p_email text, p_plate text)
returns public.profiles language plpgsql security invoker set search_path = public, pg_temp as $$
declare result public.profiles;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(p_address), 0));
  insert into public.profiles(address,role,name,phone_e164,email,plate)
  values(p_address,p_role,p_name,p_phone,p_email,p_plate)
  on conflict(address) do update set name=excluded.name, phone_e164=excluded.phone_e164,
    email=excluded.email, plate=excluded.plate
  where profiles.role=excluded.role returning * into result;
  if result.address is null then raise exception 'role_conflict' using errcode='P0001'; end if;
  return result;
end;
$$;

-- Claim + relation/profile + destination binding commit or roll back together.
create or replace function public.accept_invite(p_token text, p_address text, p_name text default null, p_email text default null)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare invitation public.invites; account public.profiles; destination public.places;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(p_address), 0));
  select * into invitation from public.invites where token=p_token for update;
  if not found then raise exception 'invite_not_found' using errcode='P0001'; end if;
  if lower(invitation.payer_address)=lower(p_address) then raise exception 'own_invite' using errcode='P0001'; end if;
  if invitation.used_by is not null then
    if lower(invitation.used_by)=lower(p_address) then
      return jsonb_build_object('invite',to_jsonb(invitation),'alreadyAccepted',true);
    end if;
    raise exception 'invite_used' using errcode='P0001';
  end if;
  if invitation.expires_at <= now() then raise exception 'invite_expired' using errcode='P0001'; end if;
  select * into account from public.profiles where address=p_address;
  if invitation.kind='carrier' then
    if account.address is null or account.role <> 'carrier' then raise exception 'carrier_required' using errcode='P0001'; end if;
    insert into public.relations(payer_address,carrier_address,status) values(invitation.payer_address,p_address,'connected')
      on conflict(payer_address,carrier_address) do nothing;
  else
    if account.address is not null and account.role <> 'warehouse' then raise exception 'warehouse_required' using errcode='P0001'; end if;
    select * into destination from public.places where id=invitation.place_id for update;
    if not found or destination.kind <> 'destination' or destination.payer_address <> invitation.payer_address then
      raise exception 'invalid_destination' using errcode='P0001';
    end if;
    if coalesce(invitation.receiver_email,destination.receiver_email) is not null
      and lower(coalesce(invitation.receiver_email,destination.receiver_email)) <> lower(coalesce(p_email,'')) then
      raise exception 'receiver_email_mismatch' using errcode='P0001';
    end if;
    if destination.receiver_address is not null and lower(destination.receiver_address) <> lower(p_address) then
      raise exception 'receiver_already_bound' using errcode='P0001';
    end if;
    if account.address is null then insert into public.profiles(address,role,name,email) values(p_address,'warehouse',p_name,p_email); end if;
    update public.places set receiver_address=p_address where id=destination.id;
  end if;
  update public.invites set used_by=p_address,used_at=now() where token=p_token returning * into invitation;
  return jsonb_build_object('invite',to_jsonb(invitation),'alreadyAccepted',false);
end;
$$;
revoke all on function public.save_profile(text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.accept_invite(text,text,text,text) from public, anon, authenticated;
grant execute on function public.save_profile(text,text,text,text,text,text) to service_role;
grant execute on function public.accept_invite(text,text,text,text) to service_role;

commit;
