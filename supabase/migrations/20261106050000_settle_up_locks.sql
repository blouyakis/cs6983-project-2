-- Settle-up follow-up (#86, from the review of #82): the functions from the settle_up migration
-- lock what they check, start_settlement takes its cut-off from the caller and verifies the
-- balances against the database as of that moment, and an expense in an open settle-up is frozen
-- (AGENTS.md Section 6.10: a settle-up works on the balances at the moment it starts). The
-- merged migrations are left as they are; this replaces the function bodies.

-- The database's clock, so the service's cut-off and every later check agree on the time
-- (membership times come from here too, #75).
create function public.db_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

revoke all on function public.db_now() from public, anon, authenticated;
grant execute on function public.db_now() to service_role;

-- Each user's balance over the rows that will belong to the settle-up started at p_until: the
-- unsettled expenses created and the confirmed direct payments confirmed by then (AGENTS.md
-- Section 6.4, the same formula as lib/domain/balances.ts). Only a cross-check for
-- start_settlement; the app's balances still come from lib/domain.
create function public.period_balances_at(p_group_id uuid, p_until timestamptz)
returns table (user_id uuid, balance_cents bigint)
language sql
stable
set search_path = ''
as $$
  select movements.user_id, sum(movements.cents)::bigint
  from (
    select e.payer_id as user_id, e.amount_cents as cents
    from public.expenses as e
    where e.group_id = p_group_id and e.settlement_id is null and e.created_at <= p_until
    union all
    select s.user_id, -s.share_cents
    from public.expense_shares as s
    join public.expenses as e on e.id = s.expense_id
    where e.group_id = p_group_id and e.settlement_id is null and e.created_at <= p_until
    union all
    select p.from_user_id, p.amount_cents
    from public.payments as p
    where p.group_id = p_group_id and p.settlement_id is null
      and p.status = 'confirmed' and p.confirmed_at <= p_until
    union all
    select p.to_user_id, -p.amount_cents
    from public.payments as p
    where p.group_id = p_group_id and p.settlement_id is null
      and p.status = 'confirmed' and p.confirmed_at <= p_until
  ) as movements
  group by movements.user_id
  having sum(movements.cents) <> 0;
$$;

revoke all on function public.period_balances_at(uuid, timestamptz) from public, anon, authenticated;

-- Starts a settle-up at p_started_at, the cut-off the service read its balances at (from db_now).
-- Under the group lock, the balances the service passes (p_balances, a JSON array of
-- {"user_id": ..., "balance_cents": ...}; zero balances may be left out) are compared with the
-- database's as of that cut-off, so a cost that landed in between is never settled unpaid: the
-- call fails with P0001 and the service reads again. A cut-off in the future or older than a
-- minute is refused the same way. Everything else is as before: one open settle-up per group,
-- the suggested payments stored with it, and a period with nothing to pay closed at once.
drop function public.start_settlement(uuid, uuid, jsonb);

create function public.start_settlement(
  p_group_id uuid,
  p_started_by uuid,
  p_started_at timestamptz,
  p_balances jsonb,
  p_payments jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  settlement_id uuid;
begin
  perform 1 from public.groups where id = p_group_id for update;
  if not found then
    raise exception 'The group does not exist.' using errcode = 'no_data_found';
  end if;
  if exists (
    select 1 from public.settlements
    where group_id = p_group_id and status = 'open'
  ) then
    raise exception 'A settle-up is already open in this group.';
  end if;
  if p_started_at > now() or p_started_at < now() - interval '1 minute' then
    raise exception 'The settle-up''s cut-off must be within the last minute. Try again.';
  end if;
  if exists (
    (
      select user_id, balance_cents from public.period_balances_at(p_group_id, p_started_at)
      except
      select (b->>'user_id')::uuid, (b->>'balance_cents')::bigint
      from jsonb_array_elements(p_balances) as b
      where (b->>'balance_cents')::bigint <> 0
    )
    union all
    (
      select (b->>'user_id')::uuid, (b->>'balance_cents')::bigint
      from jsonb_array_elements(p_balances) as b
      where (b->>'balance_cents')::bigint <> 0
      except
      select user_id, balance_cents from public.period_balances_at(p_group_id, p_started_at)
    )
  ) then
    raise exception 'The balances changed while the settle-up was being started. Try again.';
  end if;

  insert into public.settlements (group_id, started_by, started_at)
  values (p_group_id, p_started_by, p_started_at)
  returning id into settlement_id;

  insert into public.payments (group_id, from_user_id, to_user_id, amount_cents, status, settlement_id)
  select p_group_id, payment.from_user_id, payment.to_user_id, payment.amount_cents, 'suggested', settlement_id
  from jsonb_to_recordset(p_payments)
    as payment(from_user_id uuid, to_user_id uuid, amount_cents integer);

  if jsonb_array_length(p_payments) = 0 then
    perform public.close_settlement(settlement_id);
  end if;

  return settlement_id;
end;
$$;

revoke all on function public.start_settlement(uuid, uuid, timestamptz, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.start_settlement(uuid, uuid, timestamptz, jsonb, jsonb)
  to service_role;

-- Cancel now locks the settle-up's payments before checking them, so a mark-paid that is on its
-- way waits and is then either refused by the check (it committed first) or finds no row (the
-- cancel committed first). The delete only takes suggested rows, as a second guard.
create or replace function public.cancel_settlement(p_group_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  open_id uuid;
begin
  select id into open_id
  from public.settlements
  where group_id = p_group_id and status = 'open'
  for update;
  if not found then
    raise exception 'There is no open settle-up to cancel.' using errcode = 'no_data_found';
  end if;

  perform 1 from public.payments where settlement_id = open_id for update;

  if exists (
    select 1 from public.payments
    where settlement_id = open_id and status <> 'suggested'
  ) then
    raise exception 'A payment has been marked paid, so the settle-up can only close.';
  end if;

  delete from public.payments where settlement_id = open_id and status = 'suggested';

  update public.settlements
  set status = 'cancelled',
      closed_at = now()
  where id = open_id;
end;
$$;

-- Confirm now locks the settlement row before looking at the other payments, so two confirms at
-- once run one after the other and the second one sees the first: exactly one of them closes.
create or replace function public.confirm_payment(p_payment_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  payment public.payments%rowtype;
begin
  select * into payment
  from public.payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'The payment does not exist.' using errcode = 'no_data_found';
  end if;
  if payment.status <> 'paid' then
    raise exception 'Only a payment marked paid can be confirmed.';
  end if;

  update public.payments
  set status = 'confirmed',
      confirmed_at = now()
  where id = p_payment_id;

  if payment.settlement_id is null then
    return false;
  end if;

  perform 1 from public.settlements where id = payment.settlement_id for update;

  if exists (
    select 1 from public.settlements
    where id = payment.settlement_id and status = 'open'
  ) and not exists (
    select 1 from public.payments
    where settlement_id = payment.settlement_id and status <> 'confirmed'
  ) then
    perform public.close_settlement(payment.settlement_id);
    return true;
  end if;
  return false;
end;
$$;

-- True when the expense is in the group's open settle-up: created on or before its started_at.
-- Such an expense is frozen until the period closes or the settle-up is cancelled; one created
-- later belongs to the next period and can still change.
create function public.expense_in_open_settlement(p_group_id uuid, p_created_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.settlements
    where group_id = p_group_id and status = 'open' and started_at >= p_created_at
  );
$$;

revoke all on function public.expense_in_open_settlement(uuid, timestamptz) from public, anon, authenticated;

-- update_expense also refuses an expense in an open settle-up (P0001, like a settled one).
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

-- Deleting now goes through a function with the same checks as editing, instead of a plain
-- DELETE: P0002 for an unknown expense, P0001 for a settled one or one in an open settle-up.
-- The shares go with it through the foreign key. Who may delete is the service's check.
create function public.delete_expense(p_expense_id uuid)
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

  delete from public.expenses where id = p_expense_id;
end;
$$;

revoke all on function public.delete_expense(uuid) from public, anon, authenticated;
grant execute on function public.delete_expense(uuid) to service_role;
