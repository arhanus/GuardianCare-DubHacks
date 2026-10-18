-- Care-home release. Idempotent: safe to run more than once, and also after 20261017000400.
--  * alert types/details: DEVICE_ALERT (NOT_WORN, OFFLINE) and FALL
--  * close-with-note: resolved_at, resolved_by, resolution_note
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'c'
      and c.conrelid = 'public.alerts'::regclass
      and a.attname in ('type','detail')
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.alerts add constraint alerts_type_check
  check (type in ('SOS','HEART_RATE_ALERT','MOTION_ALERT','TEMPERATURE_ALERT','DEVICE_ALERT'));
alter table public.alerts add constraint alerts_detail_check
  check (detail is null or detail in ('HR_HIGH','HR_LOW','SUDDEN_MOTION','FALL','TEMP_HIGH','TEMP_LOW','NOT_WORN','OFFLINE'));

alter table public.alerts add column if not exists resolved_at      timestamptz;
alter table public.alerts add column if not exists resolved_by      uuid;
alter table public.alerts add column if not exists resolution_note  text;
