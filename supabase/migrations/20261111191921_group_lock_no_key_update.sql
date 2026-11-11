-- update_group and add_member lock the group row FOR NO KEY UPDATE instead of FOR UPDATE (#124,
-- from the review of #116), as leave_group does (#22).
--
-- record_payment, and create_expense and complete_list_item through assert_no_former_members,
-- hold the membership rows FOR SHARE and then insert a row whose foreign key takes KEY SHARE on
-- the group row. update_group, when it sets the weights, and add_member, when it resets an uneven
-- split, hold the group row and then update those membership rows. With FOR UPDATE on the group
-- row each waited for the other, and Postgres aborted one with 40P01, a 500 for that request.
-- FOR NO KEY UPDATE doesn't conflict with KEY SHARE, so the payment or cost commits and the group
-- change goes on. It still conflicts with itself and with FOR UPDATE, so update_group, add_member,
-- leave_group, the member cap trigger and start_settlement still take turns.
--
-- start_settlement keeps FOR UPDATE: it takes no membership row lock that a cost or payment holds
-- against it, so it can only wait, never deadlock, and it relies on a payment insert waiting for
-- it (20261110182000_start_settlement_pending_payments.sql).
--
-- The merged migrations are left as they are; this replaces the function bodies. Everything else
-- is as in 20261103220010_update_group.sql and 20261109011443_add_member.sql.

-- As in 20261103220010_update_group.sql, with the group lock above.
create or replace function public.update_group(
  p_group_id uuid,
  p_name text,
  p_weights jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  listed uuid[];
  current_ids uuid[];
begin
  -- FOR NO KEY UPDATE, not FOR UPDATE (#124): it still conflicts with the member cap trigger's
  -- FOR UPDATE and with add_member, so an invite waits until this commits, but it lets through
  -- the KEY SHARE that a payment or cost insert takes on this row through its foreign key.
  perform 1 from public.groups where id = p_group_id for no key update;

  if p_weights is not null then
    select coalesce(array_agg((entry ->> 'user_id')::uuid order by (entry ->> 'user_id')::uuid), '{}')
    into listed
    from jsonb_array_elements(p_weights) as entry;

    -- A current member has left_at null, as in lib/db/group-members.ts (isMemberAt).
    select coalesce(array_agg(user_id order by user_id), '{}')
    into current_ids
    from public.group_members
    where group_id = p_group_id
      and left_at is null;

    -- Sorted arrays are equal only when every current member is listed once.
    if listed is distinct from current_ids then
      raise exception 'The weights must list every current member exactly once.'
        using errcode = 'invalid_parameter_value';
    end if;

    update public.group_members as member
    set default_share_weight = (entry ->> 'weight')::integer
    from jsonb_array_elements(p_weights) as entry
    where member.group_id = p_group_id
      and member.user_id = (entry ->> 'user_id')::uuid;
  end if;

  if p_name is not null then
    update public.groups set name = p_name where id = p_group_id;
  end if;
end;
$$;

-- As in 20261109011443_add_member.sql, with the group lock above.
create or replace function public.add_member(
  p_group_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  existing_left_at timestamptz;
  is_former boolean;
  lowest integer;
  highest integer;
  reset boolean;
  new_weight integer;
begin
  -- FOR NO KEY UPDATE, not FOR UPDATE (#124): it still conflicts with update_group, another
  -- add_member and the cap trigger, so the weights read here can't change, and no other join can
  -- land, before this commits. The cap trigger upgrades it to FOR UPDATE when the newcomer's row
  -- is written; by then the weight reset has taken the membership rows, so nothing that waits
  -- here also holds one of them.
  perform 1 from public.groups where id = p_group_id for no key update;

  select left_at into existing_left_at
  from public.group_members
  where group_id = p_group_id
    and user_id = p_user_id;
  is_former := found;

  if is_former and existing_left_at is null then
    raise exception 'They are already in this group.'
      using errcode = 'unique_violation';
  end if;

  -- A current member has left_at null, as in lib/db/group-members.ts (isMemberAt).
  select min(default_share_weight), max(default_share_weight)
  into lowest, highest
  from public.group_members
  where group_id = p_group_id
    and left_at is null;

  reset := lowest is distinct from highest;
  new_weight := case when reset then 1 else coalesce(lowest, 1) end;

  if reset then
    update public.group_members
    set default_share_weight = 1
    where group_id = p_group_id
      and left_at is null;
  end if;

  if is_former then
    update public.group_members
    set left_at = null,
        joined_at = now(),
        default_share_weight = new_weight
    where group_id = p_group_id
      and user_id = p_user_id;
  else
    insert into public.group_members (group_id, user_id, default_share_weight, joined_at)
    values (p_group_id, p_user_id, new_weight, now());
  end if;

  return jsonb_build_object('weight', new_weight, 'split_reset', reset);
end;
$$;
