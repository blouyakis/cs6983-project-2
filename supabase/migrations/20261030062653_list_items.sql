-- Things to do or buy, in a group or a personal space (user flow 2).
create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  title text not null,
  quantity integer,
  note text,
  estimated_cents integer,
  status text not null default 'open',
  added_by uuid not null,
  completed_by uuid,
  completed_at timestamptz,
  -- The expense created when it was checked off with a cost; null for no cost.
  expense_id uuid,
  created_at timestamptz not null default now(),
  constraint list_items_status_valid check (status in ('open', 'done')),
  constraint list_items_quantity_positive check (quantity is null or quantity > 0),
  constraint list_items_estimate_positive check (estimated_cents is null or estimated_cents > 0),
  -- Implications, so an unknown status fails only list_items_status_valid.
  constraint list_items_open_has_no_completion check (
    status <> 'open' or (completed_by is null and completed_at is null and expense_id is null)
  ),
  constraint list_items_done_has_completion check (
    status <> 'done' or (completed_by is not null and completed_at is not null)
  ),
  -- Any member, current or former, so history survives when they leave. Services check "current".
  constraint list_items_added_by_member foreign key (group_id, added_by)
    references public.group_members (group_id, user_id) on delete restrict,
  constraint list_items_completed_by_member foreign key (group_id, completed_by)
    references public.group_members (group_id, user_id) on delete restrict,
  -- Deleting the expense clears only expense_id, so the item stays done in its group.
  constraint list_items_expense_in_group foreign key (group_id, expense_id)
    references public.expenses (group_id, id) on delete set null (expense_id),
  constraint list_items_one_item_per_expense unique (expense_id)
);

alter table public.list_items enable row level security;

revoke all on table public.list_items from anon, authenticated;
