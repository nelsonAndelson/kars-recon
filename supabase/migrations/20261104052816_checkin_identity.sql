-- Confirm VIN and decoded identity atomically with check-in; no new columns.
create or replace function private.vehicle_command(command text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare car public.vehicles; car_id uuid; actor uuid; target public.vehicle_stage; item text; checklist jsonb; photos text[]; signed boolean;
begin
  -- Intentionally no auth.uid requirement: the owner explicitly chose no sign-in.
  -- Only these five allowlisted commands are possible, with validation here and in Zod.
  if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Invalid request'; end if;
  actor:=nullif(payload->>'actor_id','')::uuid;
  if actor is not null and not exists(select 1 from public.profiles where id=actor and active) then raise exception 'Select an active team member'; end if;
  perform set_config('kars.actor_id',coalesce(actor::text,''),true);
  if command='create' then
    if length(trim(coalesce(payload->>'stock_number',''))) not between 1 and 40 or
       length(trim(coalesce(payload->>'make',''))) not between 1 and 80 or
       length(trim(coalesce(payload->>'model',''))) not between 1 and 80 then raise exception 'Stock number, make and model are required'; end if;
    if (payload->>'purchase_date')::date > (now() at time zone 'America/New_York')::date then raise exception 'Purchase date cannot be in the future'; end if;
    car_id:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
    insert into public.vehicles(id,stock_number,vin,year,make,model,trim,color,miles_in,purchase_date,source)
    values(car_id,upper(trim(payload->>'stock_number')),nullif(upper(trim(payload->>'vin')),''),(payload->>'year')::integer,
      trim(payload->>'make'),trim(payload->>'model'),left(nullif(trim(payload->>'trim'),''),80),left(nullif(trim(payload->>'color'),''),40),
      nullif(payload->>'miles_in','')::integer,(payload->>'purchase_date')::date,(payload->>'source')::public.vehicle_source);
    return car_id;
  end if;
  car_id:=(payload->>'vehicle_id')::uuid;
  select * into car from public.vehicles where id=car_id for update;
  if not found then raise exception 'Vehicle not found'; end if;
  if command='move' then
    if car.stage::text is distinct from payload->>'expected_stage' or car.stage_entered_at is distinct from (payload->>'expected_entered_at')::timestamptz then
      raise exception 'This vehicle changed on another device. Refresh and try again.';
    end if;
    target:=(payload->>'stage')::public.vehicle_stage;
    if target is null then raise exception 'Select a stage'; end if;
    if target=car.stage then return car.id; end if;
    if target='frontline' then
      select exists(select 1 from public.activity_log a
        where a.vehicle_id=car.id and a.what like '{%' and
          (case when a.what like '{%' then a.what::jsonb else '{}'::jsonb end)->>'action'='qc_signed' and
          (case when a.what like '{%' then a.what::jsonb else '{}'::jsonb end)->>'jobs_fingerprint'=private.job_fingerprint(car.id) and
          private.qc_eligible(car.id,a.who) and
          a."when">coalesce((select max(changed_at) from public.stage_history where vehicle_id=car.id and to_stage in ('purchased','in_transit','check_in','diagnosis','repair')),'-infinity')) into signed;
      if not signed then raise exception 'A valid independent QC sign-off is required before Frontline. Move to QC and record a sign-off.'; end if;
    end if;
    update public.vehicles set stage=target,status=case when target='sold' then 'sold'::public.vehicle_status else 'active'::public.vehicle_status end where id=car.id;
  elsif command='blocker' then
    if length(coalesce(payload->>'note',''))>1000 then raise exception 'Blocker note is too long'; end if;
    update public.vehicles set blocker=nullif(payload->>'blocker','')::public.vehicle_blocker,
      blocker_note=case when nullif(payload->>'blocker','') is null then null else nullif(trim(payload->>'note'),'') end where id=car.id;
  elsif command='checkin' then
    if actor is null then raise exception 'Select who checked in the vehicle'; end if;
    if exists(select 1 from public.checkins where vehicle_id=car.id) then raise exception 'This vehicle is already checked in. Refresh to view it.'; end if;
    checklist:=payload->'checklist';
    if jsonb_typeof(checklist) is distinct from 'object' then raise exception 'Complete the check-in checklist'; end if;
    foreach item in array array['fluids','tires','warning_lights','body'] loop
      if (checklist->item->>'result') is null or (checklist->item->>'result') not in ('pass','fail') then raise exception 'Mark every checklist item pass or fail'; end if;
      if length(coalesce(checklist->item->>'notes',''))>1000 then raise exception 'Checklist note is too long'; end if;
    end loop;
    if (payload->>'keys_count')::integer not between 0 and 10 then raise exception 'Keys must be between 0 and 10'; end if;
    select coalesce(array_agg(value),'{}') into photos from jsonb_array_elements_text(coalesce(payload->'photos','[]'));
    if cardinality(photos)>4 then raise exception 'Use up to four check-in photos'; end if;
    foreach item in array photos loop
      if item not like car.id::text || '/%' or not exists(select 1 from storage.objects where bucket_id='recon-photos' and name=item) then raise exception 'Invalid check-in photo'; end if;
    end loop;
    insert into public.checkins(vehicle_id,checklist,keys_count,photos,done_by)
    values(car.id,checklist,(payload->>'keys_count')::integer,photos,actor);
    if payload ? 'identity' then
      if jsonb_typeof(payload->'identity') is distinct from 'object' or
        length(trim(coalesce(payload->'identity'->>'make',''))) not between 1 and 80 or
        length(trim(coalesce(payload->'identity'->>'model',''))) not between 1 and 80 then
        raise exception 'Confirm the vehicle make and model';
      end if;
      update public.vehicles set vin=nullif(upper(trim(payload->'identity'->>'vin')),''),
        year=(payload->'identity'->>'year')::integer,
        make=trim(payload->'identity'->>'make'),model=trim(payload->'identity'->>'model'),
        stage=case when car.stage in ('purchased','in_transit','check_in') then 'diagnosis'::public.vehicle_stage else car.stage end
      where id=car.id;
    elsif car.stage in ('purchased','in_transit','check_in') then
      update public.vehicles set stage='diagnosis' where id=car.id;
    end if;
  elsif command='qc' then
    if car.stage<>'qc' then raise exception 'Move this vehicle to QC before signing off'; end if;
    if actor is null or not private.qc_eligible(car.id,actor) then raise exception 'QC must be signed by someone other than the tech with the most completed hours, or by the owner'; end if;
    insert into public.activity_log(who,what,vehicle_id)
    values(actor,jsonb_build_object('action','qc_signed','jobs_fingerprint',private.job_fingerprint(car.id),'attribution','self_reported')::text,car.id);
  else raise exception 'Unknown vehicle command';
  end if;
  return car.id;
end $$;
