-- Synthetic demo data. Idempotent. Room 203 / Patient C has a fixed UUID shared with the app and API.
insert into public.patients (id, display_name, room_number, is_demo) values
  ('11111111-1111-4111-8111-111111111201', 'Patient A (Demo)', '201', true),
  ('11111111-1111-4111-8111-111111111202', 'Patient B (Demo)', '202', true),
  ('11111111-1111-4111-8111-111111111203', 'Patient C (Demo)', '203', true)
on conflict (id) do nothing;

insert into public.devices (id, patient_id) values
  ('guardian-001', '11111111-1111-4111-8111-111111111203')
on conflict (id) do nothing;
