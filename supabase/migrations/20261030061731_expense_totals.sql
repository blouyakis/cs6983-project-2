-- An expense's shares add up exactly to its amount (AGENTS.md Sections 6.2 and 6.3).
-- The check waits until commit, so one transaction can write an expense and all its shares.

create function public.assert_expense_total(p_expense_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  expense_amount integer;
  shares_total bigint;
begin
  select amount_cents into expense_amount from public.expenses where id = p_expense_id;
  -- Deleted together with its shares.
  if not found then
    return;
  end if;
  select coalesce(sum(share_cents), 0) into shares_total
  from public.expense_shares
  where expense_id = p_expense_id;
  if shares_total <> expense_amount then
    raise exception 'The shares of an expense must add up to its amount.'
      using errcode = 'check_violation';
  end if;
end;
$$;

create function public.enforce_expense_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'expenses' then
    perform public.assert_expense_total(new.id);
    return null;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.assert_expense_total(new.expense_id);
  end if;
  -- A share moved to another expense, or removed, changes the old expense's total too.
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.assert_expense_total(old.expense_id);
  end if;
  return null;
end;
$$;

create constraint trigger expenses_shares_add_up
after insert or update of amount_cents on public.expenses
deferrable initially deferred
for each row
execute function public.enforce_expense_total();

create constraint trigger expense_shares_add_up
after insert or update or delete on public.expense_shares
deferrable initially deferred
for each row
execute function public.enforce_expense_total();

-- Writes an expense and its shares in one transaction, the only way to add an expense with a cost
-- through the API. p_shares is a JSON array of {"user_id": ..., "share_cents": ...}. Splitting is
-- done before the call, in lib/domain; this only stores the result. Returns the expense id.
create function public.create_expense(
  p_group_id uuid,
  p_description text,
  p_amount_cents integer,
  p_payer_id uuid,
  p_spent_on date,
  p_shares jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_expense_id uuid;
begin
  insert into public.expenses (group_id, description, amount_cents, payer_id, spent_on)
  values (p_group_id, p_description, p_amount_cents, p_payer_id, p_spent_on)
  returning id into new_expense_id;

  insert into public.expense_shares (expense_id, user_id, share_cents)
  select new_expense_id, share.user_id, share.share_cents
  from jsonb_to_recordset(p_shares) as share(user_id uuid, share_cents integer);

  -- Check now, so the caller gets the error from this call instead of from the commit. Not with
  -- `set constraints ... immediate`: that lasts for the rest of the transaction, so a second call
  -- in the same transaction would fail as soon as it inserted its expense, before its shares.
  perform public.assert_expense_total(new_expense_id);
  return new_expense_id;
end;
$$;

revoke all on function public.assert_expense_total(uuid) from public, anon, authenticated;
revoke all on function public.enforce_expense_total() from public, anon, authenticated;
revoke all on function public.create_expense(uuid, text, integer, uuid, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_expense(uuid, text, integer, uuid, date, jsonb)
  to service_role;
