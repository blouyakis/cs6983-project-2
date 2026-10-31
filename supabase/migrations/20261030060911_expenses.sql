-- One cost, in a shared group or a personal space. Money is integer cents (AGENTS.md Section 6.1).
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  description text not null,
  amount_cents integer not null,
  payer_id uuid not null,
  spent_on date not null default current_date,
  -- Null while unsettled. Once set, services reject edits and deletes with 409.
  settlement_id uuid,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint expenses_amount_not_negative check (amount_cents >= 0),
  -- Any member, current or former, so history survives when they leave. Services check "current".
  constraint expenses_payer_is_member foreign key (group_id, payer_id)
    references public.group_members (group_id, user_id) on delete restrict,
  constraint expenses_settlement_in_group foreign key (group_id, settlement_id)
    references public.settlements (group_id, id) on delete restrict,
  -- Lets list items require an expense of their own group.
  constraint expenses_group_id_id_key unique (group_id, id)
);

alter table public.expenses enable row level security;

revoke all on table public.expenses from anon, authenticated;
