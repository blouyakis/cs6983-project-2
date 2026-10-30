create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_personal boolean not null default false,
  created_by uuid not null references public.users (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index groups_one_personal_space_per_user
  on public.groups (created_by)
  where is_personal;

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete restrict,
  user_id uuid not null references public.users (id) on delete restrict,
  default_share_weight integer not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, user_id),
  constraint group_members_weight_positive check (default_share_weight > 0),
  constraint group_members_left_after_join check (left_at is null or left_at >= joined_at)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

revoke all on table public.groups from anon, authenticated;
revoke all on table public.group_members from anon, authenticated;
