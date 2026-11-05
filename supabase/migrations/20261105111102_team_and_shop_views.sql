-- Shared, no-sign-in team management. Selected identity is self-reported.
-- Original tables/columns retained; inactive profiles preserve attribution.
create function private.team_command(payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; person uuid; prior public.profiles; name text; member_role public.profile_role; enabled boolean;
begin
  perform pg_advisory_xact_lock(731303);
  actor := (payload->>'actor_id')::uuid;
  if not exists(select 1 from public.profiles where id=actor and active and public.profiles.role='owner') then
    raise exception 'Select an active admin under Working as'; end if;
  perform set_config('kars.actor_id',actor::text,true);
  person := (payload->>'id')::uuid;
  name := trim(payload->>'full_name'); member_role := (payload->>'role')::public.profile_role;
  enabled := (payload->>'active')::boolean;
  if person is null or name is null or length(name) not between 1 and 80 or member_role is null or enabled is null then
    raise exception 'Enter a name, role and active status'; end if;
  select * into prior from public.profiles where id=person for update;
  if prior.id is not null and (payload->'expected') is distinct from to_jsonb(prior) then
    raise exception 'This team member changed. Refresh and try again.'; end if;
  if prior.id is null and payload->'expected' is distinct from 'null'::jsonb then raise exception 'Team member not found'; end if;
  if prior.role='owner' and prior.active and (member_role<>'owner' or not enabled) and
    not exists(select 1 from public.profiles p where p.id<>person and p.role='owner' and p.active) then
    raise exception 'Keep at least one active admin'; end if;
  if (not enabled or member_role<>'tech') and exists(select 1 from public.jobs where tech_id=person and status not in ('done','cancelled')) then
    raise exception 'Reassign this person’s open jobs before removing them or changing their role'; end if;
  if exists(select 1 from public.profiles p where p.id<>person and lower(trim(p.full_name))=lower(name) and p.active and enabled) then
    raise exception 'An active team member already has this name'; end if;
  if prior.id is null then
    -- Preserve the required profiles.id -> auth.users FK without creating a usable login.
    insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,banned_until)
    values(person,'authenticated','authenticated','team-'||person::text||'@kars-recon.invalid','{}','{}',now(),now(),'infinity');
    insert into public.profiles(id,full_name,role,active) values(person,name,member_role,enabled);
  else update public.profiles set full_name=name,role=member_role,active=enabled where id=person;
  end if;
  insert into public.activity_log(who,what) values(actor,jsonb_build_object('action','team_saved','person_id',person,
    'before',to_jsonb(prior),'name',name,'role',member_role,'active',enabled,'attribution','self_reported')::text);
  return person;
end;
$$;
create function public.team_command(payload jsonb) returns uuid language sql security invoker set search_path='' as $$
 select private.team_command(payload)
$$;
revoke all on function private.team_command(jsonb),public.team_command(jsonb) from public;
grant execute on function private.team_command(jsonb),public.team_command(jsonb) to anon,authenticated;

create function private.part_command(command text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; item public.parts; car public.vehicles; result_id uuid; job uuid; cost integer; quantity integer;
begin
 perform pg_advisory_xact_lock(731303);
 actor:=(payload->>'actor_id')::uuid;
 if not exists(select 1 from public.profiles where id=actor and active and role in ('owner','tech')) then
   raise exception 'Select an active admin or technician'; end if;
 perform set_config('kars.actor_id',actor::text,true);
 if command='request' then
   select * into car from public.vehicles where id=(payload->>'vehicle_id')::uuid for update;
 else
   select * into item from public.parts where id=(payload->>'id')::uuid for update;
   if item.id is null then raise exception 'Part not found'; end if;
   select * into car from public.vehicles where id=item.vehicle_id for update;
   if payload->'expected' is distinct from to_jsonb(item) then raise exception 'This part changed. Refresh and try again.'; end if;
 end if;
 if car.id is null or car.status<>'active' then raise exception 'Select an active vehicle'; end if;
 if command='request' then
   if coalesce(length(trim(payload->>'name')),0) not between 1 and 160 then raise exception 'Enter the part needed'; end if;
   quantity := (payload->>'qty')::integer;
   if quantity is null or quantity not between 1 and 999 then raise exception 'Quantity must be 1 to 999'; end if;
   job:=nullif(payload->>'job_id','')::uuid;
   if job is not null and not exists(select 1 from public.jobs where id=job and vehicle_id=car.id and status not in ('done','cancelled')) then
     raise exception 'Select an open job on this vehicle'; end if;
   insert into public.parts(id,vehicle_id,job_id,name,qty,status) values((payload->>'id')::uuid,car.id,job,trim(payload->>'name'),quantity,'needed') returning id into result_id;
   if car.blocker is null then update public.vehicles set blocker='waiting_parts',blocker_note='Parts requested' where id=car.id; end if;
 elsif command='order' then
   if item.status<>'needed' then raise exception 'Only needed parts can be ordered'; end if;
   if coalesce(length(trim(payload->>'vendor')),0) not between 1 and 120 then raise exception 'Enter the vendor'; end if;
   cost:=(payload->>'unit_cost_cents')::integer;
   if cost is null or cost<0 or cost>100000000 then raise exception 'Enter a valid unit cost'; end if;
   update public.parts set status='ordered',vendor=trim(payload->>'vendor'),unit_cost_cents=cost,ordered_by=actor,ordered_at=clock_timestamp() where id=item.id returning id into result_id;
 elsif command='receive' then
   if item.status<>'ordered' then raise exception 'Only ordered parts can be received'; end if;
   update public.parts set status='received',received_at=clock_timestamp() where id=item.id returning id into result_id;
 else raise exception 'Unknown part command'; end if;
 insert into public.activity_log(who,what,vehicle_id) values(actor,jsonb_build_object('action','part_'||command,'part_id',result_id,
   'title',coalesce(item.name,payload->>'name'),'attribution','self_reported')::text,car.id);
 return result_id;
end;
$$;
create function public.part_command(command text,payload jsonb) returns uuid language sql security invoker set search_path='' as $$
 select private.part_command(command,payload)
$$;
revoke all on function private.part_command(text,jsonb),public.part_command(text,jsonb) from public;
grant execute on function private.part_command(text,jsonb),public.part_command(text,jsonb) to anon,authenticated;

