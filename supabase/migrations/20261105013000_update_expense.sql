-- Edits an unsettled expense in one transaction (#20, AGENTS.md Section 6.7): the description,
-- amount, day and every share are replaced together, and edited_at is set, so an expense is
-- never left with shares that don't add up to its amount. Modeled on create_expense (#43).
--
-- p_shares is a JSON array of {"user_id": ..., "share_cents": ...}, worked out before the call in
-- lib/domain. The payer is not a parameter: it can't be changed (AGENTS.md Section 6.7), and the
-- service has already checked that the caller is the payer and that the payer is a sharer.
--
-- Fails with P0002 (no_data_found) for an unknown expense, and with P0001 (raise_exception) for a
-- settled one; both leave the expense as it was. Who may edit is the service's check, not this one.
create function public.update_expense(
  p_expense_id uuid,
  p_description text,
  p_amount_cents integer,
  p_spent_on date,
  p_shares jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_settlement uuid;
begin
  -- Lock the row, so a settle-up that is about to claim this expense waits for this to commit.
  select settlement_id into current_settlement
  from public.expenses
  where id = p_expense_id
  for update;
  if not found then
    raise exception 'The expense does not exist.' using errcode = 'no_data_found';
  end if;
  if current_settlement is not null then
    raise exception 'A settled expense can''t be changed.';
  end if;

  update public.expenses
  set description = p_description,
      amount_cents = p_amount_cents,
      spent_on = p_spent_on,
      edited_at = now()
  where id = p_expense_id;

  delete from public.expense_shares where expense_id = p_expense_id;

  insert into public.expense_shares (expense_id, user_id, share_cents)
  select p_expense_id, share.user_id, share.share_cents
  from jsonb_to_recordset(p_shares) as share(user_id uuid, share_cents integer);

  -- Check now, so the caller gets the error from this call instead of from the commit (see
  -- create_expense for why not `set constraints ... immediate`).
  perform public.assert_expense_total(p_expense_id);
end;
$$;

revoke all on function public.update_expense(uuid, text, integer, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_expense(uuid, text, integer, date, jsonb)
  to service_role;
