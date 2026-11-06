-- Feed writes require a dedicated server token, never a service-role browser key.
create table private.inventory_access(singleton boolean primary key default true check(singleton), token_hash text not null);
revoke all on private.inventory_access from public,anon,authenticated;
alter table private.inventory_access enable row level security;
create table public.inventory_import_runs(
 id uuid primary key default gen_random_uuid(), started_at timestamptz not null default now(), finished_at timestamptz,
 status text not null check(status in ('fetching','success','failed')), trigger text not null check(trigger in ('manual','scheduled')),
 filename text, file_date date, file_hash text, row_count integer not null default 0,
 fresh boolean not null default false, missing_safe boolean not null default false, error text
);
create table public.inventory_import_items(
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.inventory_import_runs(id),
 row_data jsonb not null, fingerprint text not null, kind text not null check(kind in ('new','change','matched','conflict')),
 decision text not null default 'pending' check(decision in ('pending','approved','dismissed')),
 vehicle_id uuid references public.vehicles(id), expected_vehicle jsonb, note text,
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz
);
create index inventory_runs_time on public.inventory_import_runs(started_at desc);
create index inventory_items_run on public.inventory_import_items(run_id);
create index inventory_items_vin on public.inventory_import_items((row_data->>'vin'));
alter table public.inventory_import_runs enable row level security;
alter table public.inventory_import_items enable row level security;
revoke all on public.inventory_import_runs,public.inventory_import_items from anon,authenticated;
grant select on public.inventory_import_runs,public.inventory_import_items to anon,authenticated;
create policy shared_import_runs on public.inventory_import_runs for select to anon,authenticated using(true);
create policy shared_import_items on public.inventory_import_items for select to anon,authenticated using(true);

create function private.inventory_worker(command text,payload jsonb,token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare run public.inventory_import_runs; prior public.inventory_import_runs; row jsonb; car public.vehicles; previous public.inventory_import_items;
 matches integer; duplicates integer; kind text; decision text; note text; car_id uuid; row_hash text; run_id uuid; is_fresh boolean;
begin
 if token is null or length(token)<32 or not exists(select 1 from private.inventory_access where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex')) then raise exception 'Import service is not authorized'; end if;
 perform pg_advisory_xact_lock(731304);
 if command='begin' then
   update public.inventory_import_runs set status='failed',finished_at=now(),error='Fetch timed out. Retry Sync now.' where status='fetching' and started_at<now()-interval '5 minutes';
   if exists(select 1 from public.inventory_import_runs where status='fetching') then raise exception 'A sync is already running. Refresh shortly.'; end if;
   if exists(select 1 from public.inventory_import_runs where started_at>now()-interval '1 minute') then raise exception 'Please wait a minute before syncing again.'; end if;
   insert into public.inventory_import_runs(status,trigger) values('fetching',payload->>'trigger') returning id into run_id;
   return jsonb_build_object('id',run_id);
 end if;
 select * into run from public.inventory_import_runs where id=(payload->>'run_id')::uuid for update;
 if not found or run.status<>'fetching' or run.started_at<now()-interval '5 minutes' then raise exception 'This sync expired. Start a new sync.'; end if;
 if command='fail' then
   update public.inventory_import_runs set status='failed',finished_at=now(),error=left(payload->>'error',300) where id=run.id;
   return jsonb_build_object('id',run.id);
 end if;
 if command<>'finish' then raise exception 'Unknown import command'; end if;
 if jsonb_typeof(payload->'rows') is distinct from 'array' or jsonb_array_length(payload->'rows') not between 1 and 5000 or
   coalesce(payload->>'filename','') !~ '^DealerCenter_[0-9]{8}_28126551[.]csv$' or coalesce(payload->>'file_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid feed'; end if;
 select * into prior from public.inventory_import_runs where status='success' order by started_at desc limit 1;
 if (payload->>'file_date')::date < prior.file_date then raise exception 'Feed is older than the last successful import'; end if;
 is_fresh := (payload->>'file_date')::date >= (now() at time zone 'America/New_York')::date-2 and
   (payload->>'modified_at')::timestamptz >= now()-interval '48 hours' and (payload->>'file_date')::date <= (now() at time zone 'America/New_York')::date;
 for row in select value from jsonb_array_elements(payload->'rows') loop
   if coalesce(row->>'vin','') !~ '^[A-HJ-NPR-Z0-9]{17}$' or (row->>'year')::integer not between 1900 and 2100 or
      length(trim(coalesce(row->>'make',''))) not between 1 and 80 or length(trim(coalesce(row->>'model',''))) not between 1 and 80 then raise exception 'Invalid vehicle in feed'; end if;
   select count(*) into duplicates from jsonb_array_elements(payload->'rows') r where r->>'vin'=row->>'vin';
   select count(*) into matches from public.vehicles where upper(trim(vin))=row->>'vin';
   car:=null; car_id:=null; note:=null; decision:='pending';
   if matches=1 then select * into car from public.vehicles where upper(trim(vin))=row->>'vin'; car_id:=car.id; end if;
   if duplicates>1 or matches>1 then kind:='conflict'; note:='Duplicate VIN in feed or recon. Resolve the duplicate before importing.';
   elsif matches=0 then kind:='new';
   elsif exists(select 1 from jsonb_each(row) e where e.key in ('year','make','model','trim','color') and e.value not in ('null'::jsonb,'""'::jsonb) and e.value is distinct from to_jsonb(car)->e.key) then kind:='change';
   else kind:='matched'; end if;
   row_hash:=encode(sha256(convert_to(row::text,'UTF8')),'hex');
   select i.* into previous from public.inventory_import_items i join public.inventory_import_runs r on r.id=i.run_id
      where r.status='success' and i.row_data->>'vin'=row->>'vin' and i.fingerprint=row_hash and i.decision in ('approved','dismissed')
      order by r.started_at desc limit 1;
   if kind<>'conflict' and previous.id is not null and (previous.vehicle_id is not distinct from car_id) then decision:=previous.decision; end if;
   insert into public.inventory_import_items(run_id,row_data,fingerprint,kind,decision,vehicle_id,expected_vehicle,note)
     values(run.id,row,row_hash,kind,decision,car_id,case when car_id is not null then to_jsonb(car) else null end,note);
 end loop;
 update public.inventory_import_runs set status='success',finished_at=now(),filename=payload->>'filename',file_date=(payload->>'file_date')::date,
   file_hash=payload->>'file_hash',row_count=jsonb_array_length(payload->'rows'),fresh=is_fresh,
   missing_safe=is_fresh and (prior.id is null or jsonb_array_length(payload->'rows')*2>=prior.row_count),
   error=case when not is_fresh then 'This export is stale. Missing-vehicle detection is paused.' when prior.id is not null and jsonb_array_length(payload->'rows')*2<prior.row_count then 'Inventory dropped by more than half. Missing-vehicle detection is paused; check the export.' end
   where id=run.id;
 return jsonb_build_object('id',run.id,'count',jsonb_array_length(payload->'rows'));
end $$;

create function public.inventory_worker(command text,payload jsonb,token text) returns jsonb language sql security invoker set search_path='' as $$select private.inventory_worker(command,payload,token)$$;
revoke all on function private.inventory_worker(text,jsonb,text),public.inventory_worker(text,jsonb,text) from public;
grant execute on function private.inventory_worker(text,jsonb,text),public.inventory_worker(text,jsonb,text) to anon,authenticated;

create function private.inventory_review(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare item public.inventory_import_items; car public.vehicles; actor uuid; choice text; fields text[]; field text; new_id uuid; start_stage public.vehicle_stage;
begin
 actor:=(payload->>'actor_id')::uuid;
 if not exists(select 1 from public.profiles where id=actor and active and role='owner') then raise exception 'Choose an active admin to review inventory'; end if;
 perform pg_advisory_xact_lock(731304);
 select * into item from public.inventory_import_items where id=(payload->>'item_id')::uuid for update;
 if not found or item.run_id is distinct from (select id from public.inventory_import_runs where status='success' order by started_at desc limit 1) or
    item.fingerprint is distinct from payload->>'fingerprint' or item.decision<>'pending' then raise exception 'This import changed or was already reviewed. Refresh before continuing.'; end if;
 choice:=payload->>'decision';
 if choice not in ('approve','dismiss') or choice is null or item.kind='conflict' then raise exception 'Resolve conflicts before reviewing'; end if;
 perform set_config('kars.actor_id',actor::text,true);
 if choice='approve' then
   if item.vehicle_id is null then
     -- Synchronize with every vehicle writer while checking a non-unique VIN column.
     lock table public.vehicles in share row exclusive mode;
     if exists(select 1 from public.vehicles where upper(trim(vin))=item.row_data->>'vin') then raise exception 'This VIN is already in recon. Sync again to match it.'; end if;
     if length(trim(coalesce(payload->>'stock_number',''))) not between 1 and 40 then raise exception 'Enter a stock number'; end if;
     if nullif(payload->>'purchase_date','') is null or (payload->>'purchase_date')::date>(now() at time zone 'America/New_York')::date then raise exception 'Enter the actual purchase date, no later than today'; end if;
     start_stage:=(payload->>'stage')::public.vehicle_stage;
     if start_stage is null or start_stage in ('frontline','sold') then raise exception 'Choose a recon stage. Frontline requires QC sign-off after import.'; end if;
     insert into public.vehicles(stock_number,vin,year,make,model,trim,color,purchase_date,source,stage)
      values(upper(trim(payload->>'stock_number')),item.row_data->>'vin',(item.row_data->>'year')::integer,item.row_data->>'make',item.row_data->>'model',
        nullif(item.row_data->>'trim',''),nullif(item.row_data->>'color',''),(payload->>'purchase_date')::date,coalesce(payload->>'source','other')::public.vehicle_source,start_stage) returning id into new_id;
   else
     select * into car from public.vehicles where id=item.vehicle_id for update;
     if to_jsonb(car) is distinct from payload->'expected_vehicle' then raise exception 'Vehicle changed. Refresh and review the current values.'; end if;
     if upper(trim(car.vin)) is distinct from item.row_data->>'vin' or (select count(*) from public.vehicles where upper(trim(vin))=item.row_data->>'vin')<>1 then raise exception 'VIN match changed. Sync again.'; end if;
     fields:=array(select jsonb_array_elements_text(coalesce(payload->'fields','[]')));
     foreach field in array fields loop
       if field not in ('year','make','model','trim','color') then raise exception 'This field cannot be imported'; end if;
       if nullif(item.row_data->>field,'') is null then raise exception 'Blank feed values cannot replace vehicle details'; end if;
     end loop;
     update public.vehicles set
       year=case when 'year'=any(fields) then (item.row_data->>'year')::integer else year end,
       make=case when 'make'=any(fields) then item.row_data->>'make' else make end,
       model=case when 'model'=any(fields) then item.row_data->>'model' else model end,
       trim=case when 'trim'=any(fields) then item.row_data->>'trim' else trim end,
       color=case when 'color'=any(fields) then item.row_data->>'color' else color end
       where id=item.vehicle_id;
     new_id:=item.vehicle_id;
   end if;
 else new_id:=item.vehicle_id;
 end if;
 update public.inventory_import_items set decision=case when choice='approve' then 'approved' else 'dismissed' end,vehicle_id=new_id,reviewed_by=actor,reviewed_at=now() where id=item.id;
 insert into public.activity_log(who,vehicle_id,what) values(actor,new_id,jsonb_build_object('action','inventory_'||choice,'item_id',item.id,'run_id',item.run_id,'vin',item.row_data->>'vin','fields',fields)::text);
 return item.id;
end $$;
create function public.inventory_review(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.inventory_review(payload)$$;
revoke all on function private.inventory_review(jsonb),public.inventory_review(jsonb) from public;
grant execute on function private.inventory_review(jsonb),public.inventory_review(jsonb) to anon,authenticated;

create function private.inventory_read() returns jsonb language sql security definer set search_path='' as $$
 with latest as (select * from public.inventory_import_runs where status='success' order by started_at desc limit 1)
 select jsonb_build_object(
 'runs',(select coalesce(jsonb_agg(r order by r.started_at desc),'[]') from (select * from public.inventory_import_runs order by started_at desc limit 20) r),
 'latest',(select to_jsonb(latest) from latest),
 'items',(select coalesce(jsonb_agg(i order by i.row_data->>'make',i.row_data->>'model'),'[]') from public.inventory_import_items i where i.run_id=(select id from latest)),
 'vehicles',(select coalesce(jsonb_agg(v),'[]') from public.vehicles v),
 'profiles',(select coalesce(jsonb_agg(p order by p.full_name),'[]') from public.profiles p),
 'missing',(select coalesce(jsonb_agg(v),'[]') from public.vehicles v where v.status='active' and
   exists(select 1 from latest where missing_safe and file_date>=(now() at time zone 'America/New_York')::date-2 and finished_at>now()-interval '48 hours') and
   not exists(select 1 from public.inventory_import_items i where i.run_id=(select id from latest) and i.row_data->>'vin'=upper(trim(v.vin)))));
$$;
create function public.inventory_read() returns jsonb language sql security invoker set search_path='' as $$select private.inventory_read()$$;
revoke all on function private.inventory_read(),public.inventory_read() from public;
grant execute on function private.inventory_read(),public.inventory_read() to anon,authenticated;
