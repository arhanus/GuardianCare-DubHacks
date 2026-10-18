-- Expo push tokens of caregiver phones. Idempotent. Written only by the backend (service-role key).
-- DEMO-ONLY: single care home, so a token is not tied to a user; every token receives every alert.
create table if not exists public.push_tokens (
  token       text primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
