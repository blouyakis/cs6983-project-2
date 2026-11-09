-- Leaving a group (#22, AGENTS.md user flow 8 and Sections 6.8 and 6.9), in one transaction, as
-- architecture.md Section 6 asks: the zero-balance check, left_at, and archiving the group when
-- its last member leaves.
--
-- The member must be a current member of a shared group. A personal space can't be left: it
-- would have no current member, and its owner would get 403 on their own space (#81 review).
--
-- Their balance for the current period must be zero. It is the formula of lib/domain/balances.ts
-- (AGENTS.md Section 6.4) over the rows getGroupPeriod reads: expenses and confirmed payments
-- whose settlement_id is null or the open settlement's. So a suggested payment of an open
-- settle-up that was confirmed counts, which period_balances_at, a cut-off check for
-- start_settlement, leaves out.
--
-- No payment to or from them may be suggested or paid. A paid one doesn't count in the balance
-- until it is confirmed, and once they leave nobody could confirm it or mark it paid (#107
-- review). A suggested one is part of an open settle-up that can only close once it is paid and
-- confirmed, even if a cost added since has brought their balance to zero.
--
-- Locks: the group row first, FOR NO KEY UPDATE, so a settle-up starting and a member joining
-- (both lock it FOR UPDATE) and the last two members leaving at once each wait for the other,
-- and the group is archived exactly once. Not FOR UPDATE: create_expense and record_payment hold
-- membership rows FOR SHARE and then insert a row whose foreign key takes KEY SHARE on the group
-- row, which FOR UPDATE would block while this waits for their membership row, a deadlock. Then
-- the member's row FOR UPDATE, which their FOR SHARE waits for, so a cost or payment can't be
-- written for them between the checks and the update.
--
-- left_at and archived_at are the database's now() (#75), the same moment for the last member.
-- P0001 with the hint not_member, personal_space, pending_payment or nonzero_balance, so the app
-- tells them apart without reading the message.
create function public.leave_group(
  p_group_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_is_personal boolean;
  v_open_settlement_id uuid;
  v_balance_cents bigint;
begin
  select g.is_personal into v_is_personal
  from public.groups as g
  where g.id = p_group_id
  for no key update;

  perform 1
  from public.group_members as gm
  where gm.group_id = p_group_id and gm.user_id = p_user_id and gm.left_at is null
  for update;
  if not found then
    raise exception 'You are not a current member of this group.'
      using hint = 'not_member';
  end if;

  if v_is_personal then
    raise exception 'A personal space can''t be left.'
      using hint = 'personal_space';
  end if;

  if exists (
    select 1
    from public.payments as p
    where p.group_id = p_group_id
      and p_user_id in (p.from_user_id, p.to_user_id)
      and p.status in ('suggested', 'paid')
  ) then
    raise exception 'A payment to or from you is still waiting, so you can''t leave yet.'
      using hint = 'pending_payment';
  end if;

  select s.id into v_open_settlement_id
  from public.settlements as s
  where s.group_id = p_group_id and s.status = 'open';

  select coalesce(sum(movements.cents), 0) into v_balance_cents
  from (
    select e.amount_cents::bigint as cents
    from public.expenses as e
    where e.group_id = p_group_id
      and e.payer_id = p_user_id
      and (e.settlement_id is null or e.settlement_id = v_open_settlement_id)
    union all
    select -s.share_cents::bigint
    from public.expense_shares as s
    join public.expenses as e on e.id = s.expense_id
    where e.group_id = p_group_id
      and s.user_id = p_user_id
      and (e.settlement_id is null or e.settlement_id = v_open_settlement_id)
    union all
    select case when p.from_user_id = p_user_id then p.amount_cents else -p.amount_cents end
    from public.payments as p
    where p.group_id = p_group_id
      and p_user_id in (p.from_user_id, p.to_user_id)
      and p.status = 'confirmed'
      and (p.settlement_id is null or p.settlement_id = v_open_settlement_id)
  ) as movements;

  if v_balance_cents <> 0 then
    raise exception 'Your balance in this group isn''t zero, so settle up before you leave.'
      using hint = 'nonzero_balance';
  end if;

  update public.group_members as gm
  set left_at = now()
  where gm.group_id = p_group_id and gm.user_id = p_user_id;

  if not exists (
    select 1
    from public.group_members as gm
    where gm.group_id = p_group_id and gm.left_at is null
  ) then
    update public.groups as g
    set archived_at = now()
    where g.id = p_group_id;
  end if;
end;
$$;

revoke all on function public.leave_group(uuid, uuid) from public, anon, authenticated;
grant execute on function public.leave_group(uuid, uuid) to service_role;
