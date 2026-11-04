-- Weights are ratios, so 100 is enough for any whole-percent split such as 37/63. The cap keeps
-- amount × total weight a safe integer when lib/domain/splits.ts splits the largest amount among
-- 12 members.
alter table public.group_members
  add constraint group_members_weight_at_most_100 check (default_share_weight <= 100);

-- A new shared group and its creator's membership in one transaction (user flow 1). Every new
-- member starts at weight 1, an even split. Returns the group's id.
create function public.create_group(
  p_name text,
  p_created_by uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_group_id uuid;
begin
  insert into public.groups (name, is_personal, created_by)
  values (p_name, false, p_created_by)
  returning id into new_group_id;

  insert into public.group_members (group_id, user_id, default_share_weight)
  values (new_group_id, p_created_by, 1);

  return new_group_id;
end;
$$;

-- Sets the default share weight of the listed current members in one transaction, so a ratio
-- such as 3:2 is never half written. p_weights is a JSON array of {"user_id", "weight"}. The
-- service checks that every current member is listed; a user who isn't one fails with P0002.
create function public.set_member_weights(
  p_group_id uuid,
  p_weights jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  entry jsonb;
begin
  for entry in select * from jsonb_array_elements(p_weights)
  loop
    update public.group_members
    set default_share_weight = (entry ->> 'weight')::integer
    where group_id = p_group_id
      and user_id = (entry ->> 'user_id')::uuid
      and left_at is null;
    if not found then
      raise exception 'Every listed user must be a current member of the group.'
        using errcode = 'no_data_found';
    end if;
  end loop;
end;
$$;

revoke all on function public.create_group(text, uuid) from public, anon, authenticated;
grant execute on function public.create_group(text, uuid) to service_role;
revoke all on function public.set_member_weights(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_member_weights(uuid, jsonb) to service_role;
