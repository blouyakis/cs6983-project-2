-- Renames a group, sets its default ratio, or both, in one transaction (#6). It replaces
-- set_member_weights, which checked the weights outside the write: the service compared them
-- with the current members first, so an invite landing in between was left out of the ratio,
-- and a rename after the weights could fail with the weights already saved.
--
-- p_name or p_weights may be null to leave that part alone. p_weights is a JSON array of
-- {"user_id", "weight"} and must list every current member exactly once, or the call fails
-- with 22023 (invalid_parameter_value) and changes nothing.
create function public.update_group(
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
  -- The member cap trigger takes the same lock, so an invite waits until this commits.
  perform 1 from public.groups where id = p_group_id for update;

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

revoke all on function public.update_group(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_group(uuid, text, jsonb) to service_role;

drop function public.set_member_weights(uuid, jsonb);
