-- A former member's balance stays as it was when they left (#22, AGENTS.md Sections 6.7 and
-- 6.8). leave_group lets them go at zero, and after that they can't add, pay or settle, so no
-- write may change what they paid or owe in the current period:
--
-- - a new cost, added directly or by checking off a list item, has only current members as payer
--   and sharers;
-- - an expense with a non-zero share of a member who left is locked like a settled one until a
--   settle-up claims it: it can't be edited, not even its description, or deleted, so its list
--   item can't be unchecked either (reopen_list_item deletes through delete_expense). The app
--   can only build an edit from the current members, so allowing some edits would offer ones
--   that always fail (#22 review); one rule for both is also easier to explain.
--
-- The services already keep a new cost to current members (lib/services/shares.ts); this is the
-- last word, for a leave that lands between that check and the write. The merged migrations are
-- left as they are; this replaces the function bodies.

-- Raises P0001 with the hint member_left when any user listed has left the group. Their
-- membership rows are locked FOR SHARE first, in user_id order, so a leave_group on its way
-- (which takes the row FOR NO KEY UPDATE) waits for this transaction, and one that came first is seen
-- here. FOR SHARE doesn't block two costs for the same people, as in record_payment. Someone who
-- was never in the group has no row, and the foreign keys and the shares trigger reject them as
-- before (23503).
create function public.assert_no_former_members(p_group_id uuid, p_user_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1
  from public.group_members as gm
  where gm.group_id = p_group_id and gm.user_id = any(p_user_ids)
  order by gm.user_id
  for share;

  if exists (
    select 1
    from public.group_members as gm
    where gm.group_id = p_group_id
      and gm.user_id = any(p_user_ids)
      and gm.left_at is not null
  ) then
    raise exception 'This would change the balance of someone who has left this group.'
      using hint = 'member_left';
  end if;
end;
$$;

revoke all on function public.assert_no_former_members(uuid, uuid[]) from public, anon, authenticated;

-- As in 20261030061731_expense_totals.sql, after checking that neither the payer nor any sharer
-- has left the group.
create or replace function public.create_expense(
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
  perform public.assert_no_former_members(
    p_group_id,
    array(
      select p_payer_id
      union
      select share.user_id
      from jsonb_to_recordset(p_shares) as share(user_id uuid, share_cents integer)
    )
  );

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

-- As in 20261106050000_settle_up_locks.sql, after checking that neither the payer nor anyone with
-- a non-zero share, before or after the edit, has left the group.
create or replace function public.update_expense(
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
  expense public.expenses%rowtype;
begin
  -- Lock the row, so a settle-up that is about to claim this expense waits for this to commit.
  select * into expense
  from public.expenses
  where id = p_expense_id
  for update;
  if not found then
    raise exception 'The expense does not exist.' using errcode = 'no_data_found';
  end if;
  if expense.settlement_id is not null then
    raise exception 'A settled expense can''t be changed.';
  end if;
  if public.expense_in_open_settlement(expense.group_id, expense.created_at) then
    raise exception 'This expense is in a settle-up that is still open, so it can''t be changed until the period closes.';
  end if;

  perform public.assert_no_former_members(
    expense.group_id,
    array(
      select expense.payer_id
      union
      select s.user_id
      from public.expense_shares as s
      where s.expense_id = p_expense_id and s.share_cents <> 0
      union
      select share.user_id
      from jsonb_to_recordset(p_shares) as share(user_id uuid, share_cents integer)
      where share.share_cents <> 0
    )
  );

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

  perform public.assert_expense_total(p_expense_id);
end;
$$;

-- As in 20261106050000_settle_up_locks.sql, after checking that neither the payer nor anyone with a
-- non-zero share has left the group. reopen_list_item deletes through here, so an item whose
-- expense a former member shares stays done.
create or replace function public.delete_expense(p_expense_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  expense public.expenses%rowtype;
begin
  select * into expense
  from public.expenses
  where id = p_expense_id
  for update;
  if not found then
    raise exception 'The expense does not exist.' using errcode = 'no_data_found';
  end if;
  if expense.settlement_id is not null then
    raise exception 'A settled expense can''t be deleted.';
  end if;
  if public.expense_in_open_settlement(expense.group_id, expense.created_at) then
    raise exception 'This expense is in a settle-up that is still open, so it can''t be deleted until the period closes.';
  end if;

  perform public.assert_no_former_members(
    expense.group_id,
    array(
      select expense.payer_id
      union
      select s.user_id
      from public.expense_shares as s
      where s.expense_id = p_expense_id and s.share_cents <> 0
    )
  );

  delete from public.expenses where id = p_expense_id;
end;
$$;

-- As in 20261107035544_complete_list_item.sql, after checking, for an item with a cost, that
-- no sharer has left the group. The caller, who pays, is checked to be a current member first.
create or replace function public.complete_list_item(
  item_id uuid,
  user_id uuid,
  group_id uuid,
  amount_cents integer,
  shares jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_title text;
  v_expense_id uuid;
begin
  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = complete_list_item.group_id
      and gm.user_id = complete_list_item.user_id
      and gm.left_at is null
  ) then
    raise exception 'User is not a current member of this group.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Lock the row, so two members checking it off at once can't both create an expense.
  select li.title into v_title
  from public.list_items li
  where li.id = complete_list_item.item_id
    and li.group_id = complete_list_item.group_id
    and li.status = 'open'
  for update;
  if not found then
    raise exception 'Item not found or already completed.' using errcode = 'no_data_found';
  end if;

  if complete_list_item.amount_cents > 0 then
    perform public.assert_no_former_members(
      complete_list_item.group_id,
      array(
        select complete_list_item.user_id
        union
        select share.key::uuid
        from jsonb_each_text(complete_list_item.shares) as share
      )
    );

    insert into public.expenses (group_id, description, amount_cents, payer_id, spent_on)
    values (
      complete_list_item.group_id,
      v_title,
      complete_list_item.amount_cents,
      complete_list_item.user_id,
      current_date
    )
    returning id into v_expense_id;

    insert into public.expense_shares (expense_id, user_id, share_cents)
    select v_expense_id, share.key::uuid, share.value::integer
    from jsonb_each_text(complete_list_item.shares) as share;

    -- Check now, so the caller gets the error from this call instead of from the commit (see
    -- create_expense).
    perform public.assert_expense_total(v_expense_id);
  end if;

  update public.list_items li
  set status = 'done',
      completed_by = complete_list_item.user_id,
      completed_at = now(),
      expense_id = v_expense_id
  where li.id = complete_list_item.item_id;

  return v_expense_id;
end;
$$;
