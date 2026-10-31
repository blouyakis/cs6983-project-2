-- Who shares an expense and how much (AGENTS.md Sections 6.2 and 6.3).
create table public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete restrict,
  share_cents integer not null,
  primary key (expense_id, user_id),
  constraint expense_shares_not_negative check (share_cents >= 0)
);

-- The row has no group_id for a composite foreign key, so look the group up through the expense.
-- Any member, current or former, as for the payer.
create function public.enforce_share_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An unknown expense is left to the foreign key, which reports it more clearly.
  if not exists (select 1 from public.expenses where id = new.expense_id) then
    return new;
  end if;
  if not exists (
    select 1
    from public.expenses e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = new.expense_id
      and gm.user_id = new.user_id
  ) then
    raise exception 'A share must belong to a member of the expense''s group.'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger expense_shares_member_only
before insert or update of expense_id, user_id on public.expense_shares
for each row
execute function public.enforce_share_member();

alter table public.expense_shares enable row level security;

revoke all on table public.expense_shares from anon, authenticated;
revoke all on function public.enforce_share_member() from public, anon, authenticated;
