-- One settle-up period of a group (AGENTS.md Section 6.10).
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  status text not null default 'open',
  started_by uuid not null,
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint settlements_status_valid check (status in ('open', 'closed', 'cancelled')),
  constraint settlements_closed_at_matches_status check ((status = 'open') = (closed_at is null)),
  constraint settlements_closed_after_start check (closed_at is null or closed_at >= started_at),
  -- Any member, current or former, so history survives when they leave. Services check "current".
  constraint settlements_started_by_member foreign key (group_id, started_by)
    references public.group_members (group_id, user_id) on delete restrict,
  -- Lets expenses and payments require a settlement of their own group.
  constraint settlements_group_id_id_key unique (group_id, id)
);

create unique index settlements_one_open_per_group
  on public.settlements (group_id)
  where status = 'open';

alter table public.settlements enable row level security;

revoke all on table public.settlements from anon, authenticated;
