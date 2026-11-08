-- Records a direct payment (#14, AGENTS.md user flow 6): money the sender says they sent to
-- another member outside the app. It starts as paid and counts in balances only once the
-- recipient confirms it (Section 6.4).
--
-- paid_at is the database's now(), like confirm_payment's confirmed_at, so
-- payments_confirmed_after_paid can't fail because the app server's clock runs ahead.
--
-- Both people must be current members. Their membership rows are locked first, so a leave that
-- is on its way can't land between this check and the insert. P0001 when either isn't a current
-- member; paying yourself or an amount of 0 or less fails the table's own checks (23514).
create function public.record_payment(
  p_group_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount_cents integer
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_payment_id uuid;
begin
  perform 1
  from public.group_members
  where group_id = p_group_id and user_id in (p_from_user_id, p_to_user_id)
  order by user_id
  for update;

  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_from_user_id and left_at is null
  ) then
    raise exception 'The sender is not a current member of this group.';
  end if;

  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_to_user_id and left_at is null
  ) then
    raise exception 'The recipient is not a current member of this group.';
  end if;

  insert into public.payments (group_id, from_user_id, to_user_id, amount_cents, status, paid_at)
  values (p_group_id, p_from_user_id, p_to_user_id, p_amount_cents, 'paid', now())
  returning id into new_payment_id;

  return new_payment_id;
end;
$$;

revoke all on function public.record_payment(uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.record_payment(uuid, uuid, uuid, integer) to service_role;
