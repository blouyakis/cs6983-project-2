create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint users_email_lowercase check (email = lower(email)),
  constraint users_email_key unique (email)
);

alter table public.users enable row level security;

revoke all on table public.users from anon, authenticated;
