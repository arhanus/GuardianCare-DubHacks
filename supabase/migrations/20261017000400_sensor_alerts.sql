-- Adds motion/temperature alert types and the in-app SOS source. Idempotent.
-- Drops existing CHECK constraints on the affected columns by looking them up (auto-generated names vary).
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'c'
      and ((c.conrelid = 'public.alerts'::regclass and a.attname in ('type','detail','source'))
        or (c.conrelid = 'public.sensor_readings'::regclass and a.attname = 'source'))%s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.alerts add constraint alerts_type_check
  check (type in ('SOS','HEART_RATE_ALERT','MOTION_ALERT','TEMPERATURE_ALERT'));
alter table public.alerts add constraint alerts_detail_check
  check (detail is null or detail in ('HR_HIGH','HR_LOW','SUDDEN_MOTION','TEMP_HIGH','TEMP_LOW'));
alter table public.alerts add constraint alerts_source_check
  check (source in ('device','simulation','app'));
alter table public.sensor_readings add constraint sensor_readings_source_check
  check (source in ('device','simulation','app'));
