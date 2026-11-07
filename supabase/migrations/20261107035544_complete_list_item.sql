-- Check off and uncheck a list item (#12, AGENTS.md user flow 2 and Section 6.7), each in one
-- transaction, so an item is never done without its expense or open with one left behind.
--
-- The parameters keep the names the service and tests pass to `rpc`. They match column names, so
-- every column below is qualified with its table alias and every parameter with its function
-- name; an unqualified `group_id` is ambiguous in PL/pgSQL and fails with 42702.
--
-- Errors: insufficient_privilege (42501) for a caller who isn't a current member, or who isn't
-- the member who checked the item off; no_data_found (P0002) for an unknown item or one in the
-- wrong state (open when unchecking, done when checking off); raise_exception (P0001), from
-- delete_expense, when unchecking an item whose expense is settled or in an open settle-up.

-- Marks an open item done. With a cost it also writes an expense paid by the caller, with
-- `shares` as a JSON object of {"<user id>": <share cents>}. Returns the expense id, or null for
-- no cost.
create function public.complete_list_item(
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

-- Reopens a done item and deletes its expense, if it has one. Only the member who checked it off
-- may, and only while the expense can still be deleted (AGENTS.md Section 6.7).
create function public.reopen_list_item(
  item_id uuid,
  user_id uuid,
  group_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_completed_by uuid;
begin
  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = reopen_list_item.group_id
      and gm.user_id = reopen_list_item.user_id
      and gm.left_at is null
  ) then
    raise exception 'User is not a current member of this group.'
      using errcode = 'insufficient_privilege';
  end if;

  select li.expense_id, li.completed_by into v_expense_id, v_completed_by
  from public.list_items li
  where li.id = reopen_list_item.item_id
    and li.group_id = reopen_list_item.group_id
    and li.status = 'done'
  for update;
  if not found then
    raise exception 'Item not found or not completed.' using errcode = 'no_data_found';
  end if;

  if v_completed_by <> reopen_list_item.user_id then
    raise exception 'Only the member who checked it off can uncheck it.'
      using errcode = 'insufficient_privilege';
  end if;

  -- delete_expense refuses a settled expense or one in an open settle-up (P0001), and the
  -- foreign key on list_items clears expense_id when it goes; the shares cascade.
  if v_expense_id is not null then
    perform public.delete_expense(v_expense_id);
  end if;

  update public.list_items li
  set status = 'open', completed_by = null, completed_at = null, expense_id = null
  where li.id = reopen_list_item.item_id;
end;
$$;

-- Only the server calls these, with the service role (like create_expense).
revoke all on function public.complete_list_item(uuid, uuid, uuid, integer, jsonb)
  from public, anon, authenticated;
revoke all on function public.reopen_list_item(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_list_item(uuid, uuid, uuid, integer, jsonb)
  to service_role;
grant execute on function public.reopen_list_item(uuid, uuid, uuid)
  to service_role;
