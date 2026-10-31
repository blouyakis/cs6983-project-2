-- Money sent outside the app (AGENTS.md Section 6.9). Only confirmed payments count in balances.
-- Lifecycle: suggested (by a settle-up) -> paid (sender) -> confirmed (recipient). A direct payment
-- starts at paid.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  from_user_id uuid not null,
  to_user_id uuid not null,
  amount_cents integer not null,
  status text not null,
  -- The settle-up that suggested it; null for a direct payment until its period closes.
  settlement_id uuid,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  confirmed_at timestamptz,
  constraint payments_amount_positive check (amount_cents > 0),
  constraint payments_different_people check (from_user_id <> to_user_id),
  constraint payments_status_valid check (status in ('suggested', 'paid', 'confirmed')),
  constraint payments_suggested_has_settlement check (status <> 'suggested' or settlement_id is not null),
  -- One implication per status, so an unknown status fails only payments_status_valid.
  constraint payments_times_match_status check (
    (status <> 'suggested' or (paid_at is null and confirmed_at is null))
    and (status <> 'paid' or (paid_at is not null and confirmed_at is null))
    and (status <> 'confirmed' or (paid_at is not null and confirmed_at is not null))
  ),
  constraint payments_confirmed_after_paid check (confirmed_at is null or confirmed_at >= paid_at),
  -- Any member, current or former, so history survives when they leave. Services check "current".
  constraint payments_from_is_member foreign key (group_id, from_user_id)
    references public.group_members (group_id, user_id) on delete restrict,
  constraint payments_to_is_member foreign key (group_id, to_user_id)
    references public.group_members (group_id, user_id) on delete restrict,
  constraint payments_settlement_in_group foreign key (group_id, settlement_id)
    references public.settlements (group_id, id) on delete restrict
);

alter table public.payments enable row level security;

revoke all on table public.payments from anon, authenticated;
