-- A settle-up can't start while a direct payment in the group is paid but not yet confirmed
-- (#112, from the review of #107; AGENTS.md Section 6.10).
--
-- Balances count only confirmed payments (period_balances_at, lib/domain/balances.ts). A direct
-- payment starts as paid, so until its recipient confirms it the debt it pays still shows in the
-- balances, and a settle-up started then would suggest the same money again: Ana records $8.83
-- to Sam, the settle-up suggests "Ana → Sam $8.83", and Ana pays twice. So start_settlement now
-- refuses with P0001 and the hint pending_direct_payment until the recipient has confirmed it.
--
-- A direct payment is one with no settlement_id; a paid payment of an earlier settle-up can't
-- exist here, because that settle-up would still be open and is refused first. The check runs
-- under the group lock. record_payment's insert takes a key-share lock on the group row through
-- its foreign key, so a payment being recorded at the same moment either commits first and is
-- seen here, or waits for this to commit and then belongs to the next period, like any direct
-- payment added while a settle-up is open.
--
-- The merged migrations are left as they are; this replaces the function body. Everything else
-- is as in 20261106050000_settle_up_locks.sql.
create or replace function public.start_settlement(
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
  if exists (
    select 1 from public.payments as p
    where p.group_id = p_group_id and p.settlement_id is null and p.status = 'paid'
  ) then
    raise exception 'A direct payment in this group hasn''t been confirmed yet. A settle-up can start once its recipient has confirmed it.'
      using hint = 'pending_direct_payment';
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
