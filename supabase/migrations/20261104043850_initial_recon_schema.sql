-- Original SPEC.md tables/columns; shared-read access approved in DECISIONS.md.
create type public.profile_role as enum ('owner','tech','advisor','viewer');
create type public.vehicle_stage as enum ('purchased','in_transit','check_in','diagnosis','repair','qc','detail','photos','frontline','sold');
create type public.vehicle_blocker as enum ('waiting_parts','waiting_approval','waiting_diagnosis','at_sublet','no_tech_available','other');
create type public.vehicle_status as enum ('active','sold','wholesaled');
create type public.vehicle_source as enum ('ACV','Manheim','Skipco','Akron Auto','other');
create type public.job_category as enum ('mechanical','electrical','body','tires','brakes','detail','other');
create type public.job_status as enum ('pending','needs_approval','approved','in_progress','done','cancelled');
create type public.part_status as enum ('needed','ordered','received','installed','return_pending','returned');

create table public.profiles (
  id uuid primary key references auth.users(id),
  full_name text not null check (length(trim(full_name)) > 0),
  role public.profile_role not null default 'viewer',
  active boolean not null default true
);
create table public.tech_pay_rates (
  tech_id uuid not null references public.profiles(id),
  rate_cents_per_hour integer not null check (rate_cents_per_hour >= 0),
  effective_from date not null,
  created_by uuid references public.profiles(id),
  primary key (tech_id,effective_from)
);
create table public.settings (
  default_recon_budget_cents integer not null default 80000 check(default_recon_budget_cents >= 0),
  budget_warning_pct integer not null default 80 check(budget_warning_pct between 1 and 100),
  stage_target_days jsonb not null default '{"purchased":1,"in_transit":2,"check_in":1,"diagnosis":1,"repair":3,"qc":1,"detail":1,"photos":1,"frontline":7,"sold":1}'::jsonb check(jsonb_typeof(stage_target_days) = 'object'),
  total_target_days integer not null default 8 check(total_target_days > 0)
);
create unique index settings_single_row on public.settings ((true));
insert into public.settings default values;
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  stock_number text not null unique check(length(trim(stock_number)) > 0),
  vin text check(vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  year integer not null check(year between 1900 and 2100),
  make text not null,
  model text not null,
  trim text,
  color text,
  miles_in integer check(miles_in >= 0),
  purchase_date date not null,
  source public.vehicle_source not null default 'other',
  stage public.vehicle_stage not null default 'purchased',
  stage_entered_at timestamptz not null default now(),
  blocker public.vehicle_blocker,
  blocker_note text,
  recon_budget_cents integer not null check(recon_budget_cents >= 0),
  status public.vehicle_status not null default 'active',
  created_at timestamptz not null default now(),
  check(blocker is distinct from 'other' or length(trim(coalesce(blocker_note,''))) > 0)
);
create table public.stage_history (
  vehicle_id uuid not null references public.vehicles(id),
  from_stage public.vehicle_stage,
  to_stage public.vehicle_stage not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);
create table public.checkins (
  vehicle_id uuid primary key references public.vehicles(id),
  checklist jsonb not null default '{}'::jsonb check(jsonb_typeof(checklist) = 'object'),
  keys_count integer not null default 1 check(keys_count >= 0),
  photos text[] not null default '{}',
  done_by uuid references public.profiles(id),
  done_at timestamptz not null default now()
);
create table public.pay_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique check(extract(isodow from week_start) = 1),
  locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id),
  check((not locked and locked_at is null) or (locked and locked_at is not null))
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  title text not null check(length(trim(title)) > 0),
  category public.job_category not null default 'other',
  book_hours numeric(6,2) not null default 0 check(book_hours >= 0),
  tech_id uuid references public.profiles(id),
  status public.job_status not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  is_comeback boolean not null default false,
  original_job_id uuid references public.jobs(id),
  notes text,
  pay_week_id uuid references public.pay_weeks(id),
  unique(id,vehicle_id),
  check(original_job_id is null or original_job_id <> id),
  check(not is_comeback or original_job_id is not null),
  check(status <> 'done' or (completed_at is not null and tech_id is not null)),
  check(completed_at is null or started_at is null or completed_at >= started_at),
  check(pay_week_id is null or status = 'done')
);
create table public.parts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  job_id uuid,
  name text not null check(length(trim(name)) > 0),
  part_number text,
  vendor text,
  qty integer not null default 1 check(qty > 0),
  unit_cost_cents integer not null default 0 check(unit_cost_cents >= 0),
  status public.part_status not null default 'needed',
  ordered_by uuid references public.profiles(id),
  ordered_at timestamptz,
  received_at timestamptz,
  installed_at timestamptz,
  return_due_date date,
  returned_at timestamptz,
  refund_cents integer not null default 0 check(refund_cents >= 0),
  core_charge_cents integer not null default 0 check(core_charge_cents >= 0),
  core_due_date date,
  core_returned_at timestamptz,
  core_refund_cents integer not null default 0 check(core_refund_cents >= 0),
  receipt_photo text,
  foreign key(job_id,vehicle_id) references public.jobs(id,vehicle_id),
  check(refund_cents <= qty::bigint * unit_cost_cents),
  check(core_refund_cents <= core_charge_cents),
  check(status <> 'ordered' or ordered_at is not null),
  check(status not in ('received','installed') or received_at is not null),
  check(status <> 'installed' or installed_at is not null),
  check(status <> 'returned' or returned_at is not null)
);
create table public.sublets (
  vehicle_id uuid not null references public.vehicles(id),
  vendor text not null,
  description text not null,
  cost_cents integer not null check(cost_cents >= 0),
  sent_at timestamptz,
  returned_at timestamptz,
  check(returned_at is null or sent_at is null or returned_at >= sent_at)
);
create table public.activity_log (
  who uuid references public.profiles(id),
  what text not null,
  vehicle_id uuid references public.vehicles(id),
  "when" timestamptz not null default now()
);

create index vehicles_stage_idx on public.vehicles(stage,status);
create index stage_history_vehicle_time_idx on public.stage_history(vehicle_id,changed_at);
create index jobs_vehicle_idx on public.jobs(vehicle_id);
create index jobs_tech_status_idx on public.jobs(tech_id,status);
create index jobs_original_idx on public.jobs(original_job_id);
create index jobs_pay_week_idx on public.jobs(pay_week_id);
create index parts_vehicle_status_idx on public.parts(vehicle_id,status);
create index parts_job_idx on public.parts(job_id,vehicle_id);
create index parts_return_due_idx on public.parts(return_due_date) where status = 'return_pending';
create index parts_core_due_idx on public.parts(core_due_date) where core_charge_cents > core_refund_cents;
create index activity_log_vehicle_time_idx on public.activity_log(vehicle_id,"when");
create index sublets_vehicle_idx on public.sublets(vehicle_id);

-- Functions are internal trigger helpers, not exposed application endpoints.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create function private.prepare_vehicle() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.recon_budget_cents is null then
    select default_recon_budget_cents into new.recon_budget_cents from public.settings;
    new.recon_budget_cents := coalesce(new.recon_budget_cents,80000);
  end if;
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.stage_entered_at := clock_timestamp();
  end if;
  return new;
end;
$$;
create trigger prepare_vehicle before insert or update on public.vehicles for each row execute function private.prepare_vehicle();

create function private.record_stage() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.stage_history(vehicle_id,from_stage,to_stage,changed_at) values(new.id,null,new.stage,new.stage_entered_at);
  elsif new.stage is distinct from old.stage then
    insert into public.stage_history(vehicle_id,from_stage,to_stage,changed_at) values(new.id,old.stage,new.stage,new.stage_entered_at);
  end if;
  return new;
end;
$$;
create trigger record_stage after insert or update on public.vehicles for each row execute function private.record_stage();

create function private.audit_change() returns trigger language plpgsql set search_path = '' as $$
declare row_data jsonb; car_id uuid;
begin
  if tg_op = 'DELETE' then row_data := to_jsonb(old); else row_data := to_jsonb(new); end if;
  if tg_table_name = 'vehicles' then car_id := (row_data->>'id')::uuid;
  else car_id := (row_data->>'vehicle_id')::uuid; end if;
  -- No authenticated person in shared mode; do not fabricate attribution.
  insert into public.activity_log(who,what,vehicle_id) values(null,tg_table_name || ':' || lower(tg_op),car_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create function private.keep_rate_history() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Pay rates are append-only. Insert a new effective date.'; end;
$$;
create trigger keep_rate_history before update or delete on public.tech_pay_rates for each row execute function private.keep_rate_history();

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','tech_pay_rates','settings','vehicles','stage_history','checkins','jobs','parts','sublets','pay_weeks','activity_log'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from anon, authenticated',table_name);
    execute format('grant select on public.%I to anon, authenticated',table_name);
    execute format('create policy shared_shop_read on public.%I for select to anon, authenticated using (true)',table_name);
    if table_name not in ('activity_log','stage_history') then
      execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',table_name);
    end if;
  end loop;
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema public to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('recon-photos','recon-photos',false,10485760,array['image/jpeg','image/png','image/webp','image/heic']),
       ('recon-receipts','recon-receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
-- No uploads/reads until the parts/check-in milestone establishes validated object paths.
-- storage.objects already has RLS enabled by Supabase; no anonymous policies are added.
