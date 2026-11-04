-- Milestone 3. Original tables and columns are unchanged.
-- Financial events in activity_log were explicitly approved by the user.
alter table public.activity_log alter column "when" set default clock_timestamp();
create function private.event_json(value text) returns jsonb
language plpgsql immutable set search_path='' as $$
begin return value::jsonb; exception when invalid_text_representation then return '{}'::jsonb; end;
$$;

create function private.append_only_activity() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Activity and pay records are append-only'; end;
$$;
create trigger append_only_activity before update or delete on public.activity_log
for each row execute function private.append_only_activity();

-- Payroll linkage is not a change to the repair and must not invalidate QC.
create or replace function private.job_fingerprint(car uuid) returns text
language sql stable set search_path='' as $$
  select md5(coalesce(jsonb_agg(to_jsonb(j) || '{"pay_week_id":null}'::jsonb order by j.id)::text,'[]'))
  from public.jobs j where vehicle_id=car
$$;

create function private.pay_override(job uuid) returns jsonb
language sql stable set search_path='' as $$
  select private.event_json(a.what) from public.activity_log a
  where private.event_json(a.what)->>'action'='comeback_pay_override'
    and private.event_json(a.what)->>'job_id'=job::text
  order by a."when" desc limit 1
$$;
create index activity_pay_event_idx on public.activity_log
((private.event_json(what)->>'action'),(private.event_json(what)->>'job_id'),"when" desc);
create index jobs_completed_idx on public.jobs(completed_at) where status='done';

create function private.protect_paid_jobs() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op <> 'INSERT' and old.pay_week_id is not null and
     exists(select 1 from public.pay_weeks where id=old.pay_week_id and locked) then
    raise exception 'This job belongs to a locked pay week and cannot be changed';
  end if;
  if tg_op <> 'DELETE' and new.status='done' and exists(
    select 1 from public.pay_weeks w where w.locked and
    w.week_start=date_trunc('week',new.completed_at at time zone 'America/New_York')::date
  ) then raise exception 'The completion date belongs to a locked pay week'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_paid_jobs before insert or update or delete on public.jobs
for each row execute function private.protect_paid_jobs();

create function private.protect_paid_weeks() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.locked then raise exception 'Locked pay weeks cannot be changed or reopened'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_paid_weeks before update or delete on public.pay_weeks
for each row execute function private.protect_paid_weeks();

create function private.pay_rows(start_date date) returns jsonb
language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'job_id',j.id,'vehicle_id',j.vehicle_id,'stock_number',v.stock_number,'title',j.title,
    'tech_id',j.tech_id,'tech_name',p.full_name,'book_hours',j.book_hours,
    'completed_date',(j.completed_at at time zone 'America/New_York')::date,
    'rate_cents',r.rate_cents_per_hour,'rate_date',r.effective_from,
    'is_comeback',j.is_comeback,'original_job_id',j.original_job_id,
    'original_tech_id',original.tech_id,'original_tech_name',op.full_name,
    'comeback_parts_cents',case when j.is_comeback then coalesce(pc.cost,0) else 0 end,
    'override_cents',case when j.is_comeback then (o.value->>'amount_cents')::bigint end,
    'override_reason',case when j.is_comeback then o.value->>'reason' end,
    'pay_cents',case when j.is_comeback then coalesce((o.value->>'amount_cents')::bigint,0)
      when j.book_hours=0 then 0 else round(j.book_hours*r.rate_cents_per_hour)::bigint end
  ) order by p.full_name,j.completed_at,j.id),'[]'::jsonb)
  from public.jobs j join public.vehicles v on v.id=j.vehicle_id
  join public.profiles p on p.id=j.tech_id
  left join public.jobs original on original.id=j.original_job_id
  left join public.profiles op on op.id=original.tech_id
  left join lateral (select * from public.tech_pay_rates r where r.tech_id=j.tech_id
    and r.effective_from <= (j.completed_at at time zone 'America/New_York')::date
    order by r.effective_from desc limit 1) r on true
  left join lateral (select private.pay_override(j.id) value) o on true
  left join lateral (select sum(qty::bigint*unit_cost_cents+core_charge_cents-refund_cents-core_refund_cents) cost
    from public.parts where job_id=j.id) pc on true
  where j.status='done' and j.completed_at >= start_date::timestamp at time zone 'America/New_York'
    and j.completed_at < (start_date+7)::timestamp at time zone 'America/New_York'
$$;

create function private.pay_week_report(start_date date) returns jsonb
language plpgsql stable set search_path='' as $$
declare week public.pay_weeks; entries jsonb; snapshot jsonb;
begin
  if start_date is null or extract(isodow from start_date)<>1 then raise exception 'Select a Monday'; end if;
  select * into week from public.pay_weeks where week_start=start_date;
  if week.locked then
    select private.event_json(what) into snapshot from public.activity_log
    where private.event_json(what)->>'action'='pay_week_locked'
      and private.event_json(what)->>'week_id'=week.id::text order by "when" desc limit 1;
    if snapshot is null then raise exception 'Locked pay snapshot is missing. Do not recalculate a paid week.'; end if;
    entries := snapshot->'rows';
  else entries := private.pay_rows(start_date); end if;
  return jsonb_build_object('week_start',start_date,'week_id',week.id,'locked',coalesce(week.locked,false),
    'locked_at',week.locked_at,'locked_by',week.locked_by,'rows',entries,'revision',md5(entries::text));
end;
$$;

create function public.pay_week_report(start_date date) returns jsonb
language sql security invoker set search_path='' as $$ select private.pay_week_report(start_date) $$;

create function private.work_data() returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'jobs',coalesce((select jsonb_agg(to_jsonb(j)||jsonb_build_object('revision',md5(to_jsonb(j)::text),
      'override',private.pay_override(j.id)) order by j.completed_at desc nulls first,j.title,j.id) from public.jobs j),'[]'),
    'vehicles',coalesce((select jsonb_agg(v order by v.stock_number) from public.vehicles v),'[]'),
    'profiles',coalesce((select jsonb_agg(p order by p.full_name) from public.profiles p),'[]'),
    'parts',coalesce((select jsonb_agg(p order by p.name) from public.parts p),'[]'),
    'rates',coalesce((select jsonb_agg(r order by r.effective_from desc,r.tech_id) from public.tech_pay_rates r),'[]'),
    'weeks',coalesce((select jsonb_agg(w order by w.week_start desc) from public.pay_weeks w),'[]')
  )
$$;
create function public.work_data() returns jsonb language sql security invoker set search_path='' as $$
  select private.work_data()
$$;

create function private.job_command(command text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; job public.jobs; car public.vehicles; original public.jobs; job_id uuid;
  hours numeric; tech uuid; finished timestamptz; part public.parts; decision text; stamp timestamptz;
begin
  -- One short shop-level lock serializes job/rate/lock operations. No external I/O in this transaction.
  perform pg_advisory_xact_lock(731303);
  actor := nullif(payload->>'actor_id','')::uuid;
  if actor is null or not exists(select 1 from public.profiles where id=actor and active) then
    raise exception 'Select an active team member under Working as'; end if;
  perform set_config('kars.actor_id',actor::text,true);
  if command='create' then
    select * into car from public.vehicles where id=(payload->>'vehicle_id')::uuid for update;
  else
    select * into job from public.jobs where id=(payload->>'job_id')::uuid;
    if job.id is null then raise exception 'Job not found'; end if;
    select * into car from public.vehicles where id=job.vehicle_id for update;
    select * into job from public.jobs where id=job.id for update;
    if payload->>'revision' is distinct from md5(to_jsonb(job)::text) then
      raise exception 'This job changed on another device. Refresh and try again.'; end if;
    if job.pay_week_id is not null then raise exception 'This job belongs to a locked pay week'; end if;
  end if;
  if car.id is null then raise exception 'Vehicle not found'; end if;
  if car.status<>'active' and command not in ('edit') then raise exception 'Reopen the vehicle before changing its jobs'; end if;
  if command in ('create','edit') then
    if coalesce(length(trim(payload->>'title')),0) not between 1 and 160 then raise exception 'Enter a job title (up to 160 characters)'; end if;
    if coalesce(payload->>'book_hours','') !~ '^\d{1,4}(\.\d{1,2})?$' then raise exception 'Use hours with at most two decimals'; end if;
    hours := (payload->>'book_hours')::numeric;
    tech := nullif(payload->>'tech_id','')::uuid;
    if tech is not null and not exists(select 1 from public.profiles where id=tech and active and role='tech') then
      raise exception 'Select an active technician'; end if;
    if length(coalesce(payload->>'notes',''))>4000 then raise exception 'Keep notes under 4,000 characters'; end if;
    if command='create' then
      if coalesce((payload->>'is_comeback')::boolean,false) then
        select * into original from public.jobs where id=nullif(payload->>'original_job_id','')::uuid;
        if original.id is null or original.vehicle_id<>car.id or original.status<>'done' then
          raise exception 'A comeback must reference a completed job on this vehicle'; end if;
      elsif nullif(payload->>'original_job_id','') is not null then raise exception 'Original job is only for a comeback'; end if;
      insert into public.jobs(id,vehicle_id,title,category,book_hours,tech_id,notes,is_comeback,original_job_id)
      values(coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()),car.id,trim(payload->>'title'),
        (payload->>'category')::public.job_category,hours,tech,nullif(trim(payload->>'notes'),''),
        coalesce((payload->>'is_comeback')::boolean,false),original.id) returning id into job_id;
    else
      if job.status='cancelled' then raise exception 'Reopen this job before editing'; end if;
      if job.status in ('done','in_progress') and tech is null then raise exception 'This job needs an assigned technician'; end if;
      update public.jobs set title=trim(payload->>'title'),category=(payload->>'category')::public.job_category,
        book_hours=hours,tech_id=tech,notes=nullif(trim(payload->>'notes'),'') where id=job.id returning id into job_id;
    end if;
  elsif command='start' then
    if job.status not in ('pending','approved') then raise exception 'Only pending or approved jobs can start'; end if;
    if job.tech_id is null then raise exception 'Assign a technician first'; end if;
    update public.jobs set status='in_progress',started_at=clock_timestamp(),completed_at=null where id=job.id returning id into job_id;
  elsif command='done' then
    if job.status not in ('pending','approved','in_progress') then raise exception 'This job cannot be completed from its current status'; end if;
    if job.tech_id is null then raise exception 'Assign a technician first'; end if;
    stamp := clock_timestamp();
    if nullif(payload->>'completed_date','') is null or (payload->>'completed_date')::date=(stamp at time zone 'America/New_York')::date then
      finished := stamp;
    else finished := ((payload->>'completed_date')::date+time '12:00') at time zone 'America/New_York'; end if;
    if finished>stamp or (finished at time zone 'America/New_York')::date<car.purchase_date or finished<job.started_at then
      raise exception 'Completion must be after purchase/start and cannot be in the future'; end if;
    if exists(select 1 from public.pay_weeks where locked and week_start=date_trunc('week',finished at time zone 'America/New_York')::date) then
      raise exception 'The completion date belongs to a locked pay week'; end if;
    -- Explicit disposition for each outstanding part linked to this job.
    for part in select * from public.parts where public.parts.job_id=job.id and status in ('needed','ordered','received') for update loop
      decision := payload->'parts'->>part.id::text;
      if decision is null or decision not in ('used','unused') then raise exception 'Confirm whether every linked part was used'; end if;
      if decision='used' then
        if part.status<>'received' then raise exception 'Receive parts before marking them installed'; end if;
        update public.parts set status='installed',installed_at=stamp where id=part.id;
      else update public.parts set status='return_pending' where id=part.id; end if;
    end loop;
    update public.jobs set status='done',started_at=coalesce(started_at,finished),completed_at=finished where id=job.id returning id into job_id;
  elsif command='cancel' then
    if job.status='cancelled' then raise exception 'This job is already cancelled'; end if;
    if exists(select 1 from public.jobs where original_job_id=job.id) then raise exception 'This job is referenced by a comeback and cannot be cancelled'; end if;
    update public.jobs set status='cancelled' where id=job.id returning id into job_id;
  elsif command='reopen' then
    if job.status not in ('done','cancelled') then raise exception 'Only done or cancelled jobs can reopen'; end if;
    if exists(select 1 from public.jobs where original_job_id=job.id) then raise exception 'This job is referenced by a comeback and cannot be reopened'; end if;
    update public.jobs set status='pending',started_at=null,completed_at=null where id=job.id returning id into job_id;
  elsif command='need_part' then
    if job.status in ('done','cancelled') then raise exception 'Reopen this job before requesting a part'; end if;
    if coalesce(length(trim(payload->>'note')),0) not between 1 and 1000 then raise exception 'Describe the part needed'; end if;
    if car.blocker is null then update public.vehicles set blocker='waiting_parts',blocker_note=trim(payload->>'note') where id=car.id; end if;
    job_id:=job.id;
  else raise exception 'Unknown job command'; end if;
  insert into public.activity_log(who,what,vehicle_id,"when") values(actor,jsonb_build_object(
    'action','job_'||command,'job_id',job_id,'title',coalesce(payload->>'title',job.title),'note',payload->>'note',
    'attribution','self_reported')::text,car.id,clock_timestamp());
  return job_id;
end;
$$;
create function public.job_command(command text,payload jsonb) returns uuid
language sql security invoker set search_path='' as $$ select private.job_command(command,payload) $$;

create function private.pay_command(command text,payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; tech uuid; start_date date; rate integer; job public.jobs; week public.pay_weeks;
  entries jsonb; amount bigint; result_id uuid;
begin
  perform pg_advisory_xact_lock(731303);
  actor:=nullif(payload->>'actor_id','')::uuid;
  if actor is null or not exists(select 1 from public.profiles where id=actor and active and role='owner') then
    raise exception 'Select an active owner under Working as (self-reported)'; end if;
  perform set_config('kars.actor_id',actor::text,true);
  if command='rate' then
    tech:=(payload->>'tech_id')::uuid; rate:=(payload->>'rate_cents')::integer;
    start_date:=(payload->>'effective_from')::date;
    if tech is null or not exists(select 1 from public.profiles where id=tech and role='tech') then raise exception 'Technician not found'; end if;
    if rate is null or rate<0 or rate>1000000 or start_date is null then raise exception 'Enter a valid date and rate from $0 to $10,000 per hour'; end if;
    if exists(select 1 from public.tech_pay_rates where tech_id=tech and effective_from=start_date) then
      raise exception 'A rate already exists for that effective date. History is append-only; choose a new effective date.'; end if;
    insert into public.tech_pay_rates(tech_id,rate_cents_per_hour,effective_from,created_by) values(tech,rate,start_date,actor);
    insert into public.activity_log(who,what,"when") values(actor,jsonb_build_object('action','pay_rate_added',
      'tech_id',tech,'rate_cents',rate,'effective_from',start_date,'attribution','self_reported')::text,clock_timestamp());
    result_id:=tech;
  elsif command='override' then
    select * into job from public.jobs where id=(payload->>'job_id')::uuid for update;
    if job.id is null or not job.is_comeback then raise exception 'Choose a comeback job'; end if;
    if job.pay_week_id is not null then raise exception 'A locked job cannot receive a pay override'; end if;
    if payload->>'revision' is distinct from md5(to_jsonb(job)::text) or
       payload->'expected_override' is distinct from coalesce(private.pay_override(job.id),'null'::jsonb) then
      raise exception 'This job or override changed. Refresh before saving.'; end if;
    amount:=(payload->>'amount_cents')::bigint;
    if amount is null or amount<0 or amount>1000000000 then raise exception 'Enter a valid nonnegative override amount'; end if;
    if coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Explain the comeback pay override'; end if;
    insert into public.activity_log(who,what,vehicle_id,"when") values(actor,jsonb_build_object(
      'action','comeback_pay_override','job_id',job.id,'amount_cents',amount,'reason',trim(payload->>'reason'),
      'attribution','self_reported')::text,job.vehicle_id,clock_timestamp());
    result_id:=job.id;
  elsif command='lock' then
    start_date:=(payload->>'week_start')::date;
    if start_date is null or extract(isodow from start_date)<>1 then raise exception 'Select a Monday'; end if;
    if start_date+7>(clock_timestamp() at time zone 'America/New_York')::date then
      raise exception 'A week can be locked after Sunday ends. Current-week pay remains live.'; end if;
    insert into public.pay_weeks(week_start) values(start_date) on conflict(week_start) do nothing;
    select * into week from public.pay_weeks where week_start=start_date for update;
    if week.locked then raise exception 'This pay week is already locked'; end if;
    entries:=private.pay_rows(start_date);
    if payload->>'revision' is distinct from md5(entries::text) then raise exception 'Pay changed since you reviewed it. Refresh before locking.'; end if;
    if jsonb_array_length(entries)=0 then raise exception 'There are no completed jobs to lock'; end if;
    if exists(select 1 from jsonb_array_elements(entries) r where r->>'pay_cents' is null) then raise exception 'Add missing pay rates before locking'; end if;
    update public.jobs set pay_week_id=week.id where id in(select (r->>'job_id')::uuid from jsonb_array_elements(entries) r);
    insert into public.activity_log(who,what,"when") values(actor,jsonb_build_object(
      'action','pay_week_locked','week_id',week.id,'week_start',start_date,'rows',entries,
      'attribution','self_reported','version',1)::text,clock_timestamp());
    update public.pay_weeks set locked=true,locked_at=clock_timestamp(),locked_by=actor where id=week.id;
    result_id:=week.id;
  else raise exception 'Unknown pay command'; end if;
  return result_id;
end;
$$;
create function public.pay_command(command text,payload jsonb) returns uuid
language sql security invoker set search_path='' as $$ select private.pay_command(command,payload) $$;

revoke all on all functions in schema private from public,anon,authenticated;
-- Read helpers run with caller permissions, so their internal functions also need execution privileges.
grant execute on function private.event_json(text),private.pay_override(uuid),private.pay_rows(date),
  private.pay_week_report(date),private.work_data(),private.job_command(text,jsonb),private.pay_command(text,jsonb),
  private.vehicle_command(text,jsonb) to anon,authenticated;
revoke all on function public.job_command(text,jsonb),public.pay_command(text,jsonb),
  public.work_data(),public.pay_week_report(date) from public;
grant execute on function public.job_command(text,jsonb),public.pay_command(text,jsonb),
  public.work_data(),public.pay_week_report(date) to anon,authenticated;
