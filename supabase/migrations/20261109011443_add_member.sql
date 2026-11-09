-- Adds a member to a group, new or former, and gives them a default share weight, in one
-- transaction (#63). It replaces rejoin_member (#75), so both kinds of join follow one weight rule:
--
-- - If every current member has the same weight, the newcomer gets it too, so an even group
--   stays even: 50 and 50 plus Jo is 50, 50 and 50.
-- - If the weights differ, every current member, the newcomer included, goes back to 1. A ratio
--   two people agreed on says nothing about three, so even is the neutral start until someone
--   sets a new one. The result says so, and the invite form tells the user.
--
-- A former member's old weight plays no part. joined_at comes from the database's now(), the same
-- clock that stamps left_at (#75). A current member is rejected with 23505, as the primary key
-- rejects a second row, and a 13th current member with the cap trigger's 23514; either way the
-- whole call fails, so no weight changes. Returns {"weight", "split_reset"}.
create function public.add_member(
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
  -- The cap trigger and update_group take the same lock, so the weights read here can't change,
  -- and no other join can land, before this commits.
  perform 1 from public.groups where id = p_group_id for update;

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

revoke all on function public.add_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.add_member(uuid, uuid) to service_role;

drop function public.rejoin_member(uuid, uuid);
