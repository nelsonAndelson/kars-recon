-- Fake development data only. Never use this seed against a shop's existing database.
-- Re-running is a no-op once DEMO-1001 exists. No records outside this seed are changed.
do $$
declare
  person_id uuid;
  car_id uuid;
  job_uuid uuid;
  i integer;
  j integer;
  current_stage integer;
  stage_indexes integer[] := array[1,2,3,4,5,5,6,7,8,9,10,5];
  stages public.vehicle_stage[] := array['purchased','in_transit','check_in','diagnosis','repair','qc','detail','photos','frontline','sold']::public.vehicle_stage[];
  names text[] := array['Demo Owner','Demo Alex','Demo Jordan','Demo Sam','Demo Viewer'];
  roles public.profile_role[] := array['owner','tech','tech','tech','viewer']::public.profile_role[];
  makes text[] := array['Toyota','Honda','Ford','Chevrolet','Honda','Toyota','Hyundai','Ford','Kia','Nissan','Subaru','Chevrolet'];
  models text[] := array['Camry','CR-V','Escape','Malibu','Accord','RAV4','Tucson','F-150','Sportage','Rogue','Outback','Equinox'];
  part_states public.part_status[] := array['needed','ordered','received','installed','return_pending','returned']::public.part_status[];
  purchased timestamptz;
begin
  if exists(select 1 from public.vehicles where stock_number = 'DEMO-1001') then
    raise notice 'Demo data already exists; seed skipped.';
    return;
  end if;
  for i in 1..5 loop
    person_id := ('10000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    -- Profiles retain the specified auth.users FK. These fixtures cannot sign in.
    insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,banned_until)
    values(person_id,'authenticated','authenticated','demo-' || i || '@kars-recon.invalid','{}','{}',now(),now(),'infinity');
    insert into public.profiles(id,full_name,role) values(person_id,names[i],roles[i]);
    if roles[i] = 'tech' then
      insert into public.tech_pay_rates values(person_id,2200 + i*100,current_date - 180,'10000000-0000-4000-8000-000000000001');
      insert into public.tech_pay_rates values(person_id,2500 + i*100,current_date - 7,'10000000-0000-4000-8000-000000000001');
    end if;
  end loop;
  insert into public.pay_weeks(week_start) values(date_trunc('week',now() at time zone 'America/New_York')::date), (date_trunc('week',now() at time zone 'America/New_York')::date - 7);
  for i in 1..12 loop
    car_id := ('20000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    current_stage := stage_indexes[i];
    purchased := date_trunc('day',now()) - ((current_stage + 2)::text || ' days')::interval;
    insert into public.vehicles(id,stock_number,year,make,model,trim,color,miles_in,purchase_date,source,stage,stage_entered_at,blocker,blocker_note,status,created_at)
    values(car_id,'DEMO-' || (1000+i),2016 + i%6,makes[i],models[i],'SE',case when i%2 = 0 then 'Silver' else 'White' end,68000 + i*4300,purchased::date,
      case when i%2 = 0 then 'Manheim'::public.vehicle_source else 'ACV'::public.vehicle_source end,
      stages[current_stage],purchased + ((current_stage-1)::text || ' days')::interval,
      case when i in (5,12) then 'waiting_parts'::public.vehicle_blocker when i=4 then 'waiting_diagnosis'::public.vehicle_blocker when i=6 then 'waiting_approval'::public.vehicle_blocker end,
      case when i in (5,12) then 'Waiting on delivery from vendor' when i=6 then 'Additional brake work needs review' end,
      case when current_stage=10 then 'sold'::public.vehicle_status else 'active'::public.vehicle_status end,purchased);
    delete from public.stage_history where vehicle_id=car_id;
    for j in 1..current_stage loop
      insert into public.stage_history(vehicle_id,from_stage,to_stage,changed_by,changed_at)
      values(car_id,case when j=1 then null else stages[j-1] end,stages[j],'10000000-0000-4000-8000-000000000001',purchased + ((j-1)::text || ' days')::interval);
    end loop;
    if current_stage > 3 then
      insert into public.checkins(vehicle_id,checklist,keys_count,done_by,done_at)
      values(car_id,'{"fluids":{"result":"pass"},"tires":{"result":"pass"},"warning_lights":{"result":"fail","notes":"Inspect at diagnosis"},"body":{"result":"pass"}}',2,'10000000-0000-4000-8000-000000000002',purchased + interval '2 days');
    end if;
  end loop;
  for i in 1..12 loop
    job_uuid := ('30000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
    car_id := ('20000000-0000-4000-8000-' || lpad((4 + i%9)::text,12,'0'))::uuid;
    insert into public.jobs(id,vehicle_id,title,category,book_hours,tech_id,status,started_at,completed_at)
    values(job_uuid,car_id,case when i%2=0 then 'Front brake service' else 'Diagnose engine warning light' end,
      case when i%2=0 then 'brakes'::public.job_category else 'mechanical'::public.job_category end,
      (100+i*25)::numeric/100,
      ('10000000-0000-4000-8000-' || lpad((2 + i%3)::text,12,'0'))::uuid,
      case when i<=4 then 'done'::public.job_status when i=5 then 'needs_approval'::public.job_status when i<=8 then 'in_progress'::public.job_status when i<=10 then 'approved'::public.job_status else 'pending'::public.job_status end,
      case when i<=8 then now()-interval '2 days' end,
      case when i<=4 then now()-interval '1 day' end);
  end loop;
  for i in 1..2 loop
    insert into public.jobs(id,vehicle_id,title,category,book_hours,tech_id,status,started_at,completed_at,is_comeback,original_job_id,notes)
    select ('30000000-0000-4000-8000-' || lpad((12+i)::text,12,'0'))::uuid,vehicle_id,'Comeback: recheck original repair',category,1.25,tech_id,'done',now()-interval '5 hours',now()-interval '2 hours',true,id,'Fake example: no additional labor pay'
    from public.jobs where id=('30000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid;
  end loop;
  for i in 1..12 loop
    car_id := ('20000000-0000-4000-8000-' || lpad((4 + i%9)::text,12,'0'))::uuid;
    j := 1 + (i-1)%6;
    insert into public.parts(id,vehicle_id,job_id,name,part_number,vendor,qty,unit_cost_cents,status,ordered_by,ordered_at,received_at,installed_at,return_due_date,returned_at,refund_cents,core_charge_cents,core_due_date,core_returned_at,core_refund_cents)
    values(('40000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,car_id,
      ('30000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
      case when i%3=0 then 'Remanufactured alternator' when i%2=0 then 'Front brake pads' else 'Oxygen sensor' end,'DEMO-P' || i,'Demo parts supplier',1,5500+i*750,part_states[j],
      case when j>1 then '10000000-0000-4000-8000-000000000002'::uuid end,
      case when j>1 then now()-interval '4 days' end,case when j>2 then now()-interval '2 days' end,case when j=4 then now()-interval '1 day' end,
      current_date + i%5,case when j=6 then now()-interval '1 day' end,case when j=6 then 5500+i*750 else 0 end,
      case when i%3=0 then 4500 else 0 end,case when i%3=0 then current_date + i%4 end,
      case when j=6 then now()-interval '1 day' end,case when j=6 then 4500 else 0 end);
  end loop;
  insert into public.parts(vehicle_id,job_id,name,vendor,qty,unit_cost_cents,status,received_at,installed_at)
  select vehicle_id,id,'Comeback replacement seal','Demo parts supplier',1,2800,'installed',now()-interval '4 hours',now()-interval '3 hours' from public.jobs where is_comeback;
  insert into public.sublets(vehicle_id,vendor,description,cost_cents,sent_at,returned_at)
  values('20000000-0000-4000-8000-000000000007','Demo alignment shop','Four-wheel alignment',9500,now()-interval '2 days',now()-interval '1 day');
end $$;
