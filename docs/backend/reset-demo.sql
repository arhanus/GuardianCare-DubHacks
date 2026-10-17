-- Clears demo activity (alerts, readings, device last-seen). Keeps patients and devices.
-- Paste into the Supabase SQL Editor before a demo run. Safe to repeat.
delete from public.alerts;
delete from public.sensor_readings;
update public.devices set last_seen_at = null;
