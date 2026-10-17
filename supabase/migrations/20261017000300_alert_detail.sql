-- Adds alerts.detail (HR_HIGH / HR_LOW for HEART_RATE_ALERT). Idempotent.
alter table public.alerts add column if not exists detail text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'alerts_detail_check') then
    alter table public.alerts add constraint alerts_detail_check
      check (detail is null or detail in ('HR_HIGH','HR_LOW'));
  end if;
end $$;
