-- GuardianCare schema. Idempotent: safe to paste into the Supabase SQL Editor more than once.
-- DEMO-ONLY access model: any authenticated user may SELECT synthetic data. Writes happen only
-- through the backend using the secret/service-role key (which bypasses RLS). Not multi-tenant.

create extension if not exists pgcrypto;

create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null,
  room_number   text not null,
  is_demo       boolean not null default true
);

create table if not exists public.devices (
  id            text primary key,
  patient_id    uuid references public.patients(id),
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists devices_patient_id_idx on public.devices(patient_id);

create table if not exists public.sensor_readings (
  id                   uuid primary key default gen_random_uuid(),
  reading_id           text not null unique,
  device_id            text not null references public.devices(id),
  patient_id           uuid not null references public.patients(id),
  heart_rate_bpm       int check (heart_rate_bpm is null or heart_rate_bpm between 20 and 250),
  skin_temperature_c   numeric check (skin_temperature_c is null or skin_temperature_c between 20 and 45),
  acceleration_g       jsonb,
  signal_quality       text not null default 'unknown' check (signal_quality in ('good','poor','unknown')),
  source               text not null default 'device' check (source in ('device','simulation')),
  received_at          timestamptz not null default now(),
  observed_at          timestamptz
);
create index if not exists sensor_readings_patient_received_idx on public.sensor_readings(patient_id, received_at desc);
create index if not exists sensor_readings_device_id_idx on public.sensor_readings(device_id);

create table if not exists public.alerts (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients(id),
  device_id        text not null references public.devices(id),
  event_id         text unique,  -- NULL for backend-generated alerts; UNIQUE makes SOS retries idempotent
  type             text not null check (type in ('SOS','HEART_RATE_ALERT')),
  severity         text not null check (severity in ('urgent','warning')),
  status           text not null default 'open' check (status in ('open','acknowledged','resolved')),
  source           text not null default 'device' check (source in ('device','simulation')),
  created_at       timestamptz not null default now(),
  acknowledged_at  timestamptz,
  acknowledged_by  uuid
);
create index if not exists alerts_created_at_idx on public.alerts(created_at desc);
create index if not exists alerts_status_created_idx on public.alerts(status, created_at desc);
create index if not exists alerts_patient_id_idx on public.alerts(patient_id);
create index if not exists alerts_device_id_idx on public.alerts(device_id);

-- RLS: enabled everywhere; only SELECT for signed-in users. No anon access, no client writes.
alter table public.patients        enable row level security;
alter table public.devices         enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.alerts          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['patients','devices','sensor_readings','alerts'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='demo_authenticated_select') then
      execute format('create policy demo_authenticated_select on public.%I for select to authenticated using (true)', t);
    end if;
  end loop;
end $$;

grant select on public.patients, public.devices, public.sensor_readings, public.alerts to authenticated;

-- Realtime: publish alerts (and devices) changes.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='alerts') then
    alter publication supabase_realtime add table public.alerts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='devices') then
    alter publication supabase_realtime add table public.devices;
  end if;
end $$;
