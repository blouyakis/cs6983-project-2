-- Settle-up periods (#19, AGENTS.md Section 6.10, architecture.md "Settle-up periods"). Starting
-- and closing each write to several tables, so each is one transaction here. The fewest payments
-- are worked out before the call in lib/domain/settle-up.ts from the balances at that moment; the
-- functions store, cancel and close them. Who may call each is the service's check, not these.

-- Locks the period's rows into the settlement: expenses created and direct payments confirmed
-- before it started. Anything later belongs to the next period. Called only from this file.
create function public.close_settlement(p_settlement_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  settlement public.settlements%rowtype;
begin
  select * into settlement
  from public.settlements
  where id = p_settlement_id
  for update;
  if not found then
    raise exception 'The settle-up does not exist.' using errcode = 'no_data_found';
  end if;
  if settlement.status <> 'open' then
    raise exception 'The settle-up is not open.';
  end if;

  update public.settlements
  set status = 'closed',
      closed_at = now()
  where id = p_settlement_id;

  update public.expenses
  set settlement_id = p_settlement_id
  where group_id = settlement.group_id
    and settlement_id is null
    and created_at <= settlement.started_at;

  update public.payments
  set settlement_id = p_settlement_id
  where group_id = settlement.group_id
    and settlement_id is null
    and status = 'confirmed'
    and confirmed_at <= settlement.started_at;
end;
$$;

revoke all on function public.close_settlement(uuid) from public, anon, authenticated;

-- Starts a settle-up with its suggested payments. p_payments is a JSON array of
-- {"from_user_id": ..., "to_user_id": ..., "amount_cents": ...}. The group row is locked, so two
-- members starting at once get one settle-up and one P0001. With nothing to pay, the period has
-- nothing to wait for and closes at once. Returns the settlement id.
create function public.start_settlement(
  p_group_id uuid,
  p_started_by uuid,
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

  insert into public.settlements (group_id, started_by)
  values (p_group_id, p_started_by)
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

revoke all on function public.start_settlement(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_settlement(uuid, uuid, jsonb) to service_role;

-- Cancels the group's open settle-up while every payment is still suggested: deletes those
-- payments and leaves the expenses unsettled. P0002 with no open settle-up, P0001 once a payment
-- is marked paid.
create function public.cancel_settlement(p_group_id uuid)
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
  if exists (
    select 1 from public.payments
    where settlement_id = open_id and status <> 'suggested'
  ) then
    raise exception 'A payment has been marked paid, so the settle-up can only close.';
  end if;

  delete from public.payments where settlement_id = open_id;

  update public.settlements
  set status = 'cancelled',
      closed_at = now()
  where id = open_id;
end;
$$;

revoke all on function public.cancel_settlement(uuid) from public, anon, authenticated;
grant execute on function public.cancel_settlement(uuid) to service_role;

-- The recipient confirms a payment that is marked paid. When it was the last payment of an open
-- settle-up still waiting, the period closes in the same transaction. Returns whether it closed.
-- P0002 for an unknown payment, P0001 for one that isn't marked paid.
create function public.confirm_payment(p_payment_id uuid)
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

revoke all on function public.confirm_payment(uuid) from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid) to service_role;
