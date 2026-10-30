-- Registration in one transaction: the account, its personal space, and the owner's membership
-- (user flow 1). Called by the register service through rpc; returns the new user's id.
create function public.register_user(
  p_email text,
  p_password_hash text,
  p_name text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_user_id uuid;
  personal_group_id uuid;
begin
  insert into public.users (email, password_hash, name)
  values (lower(trim(p_email)), p_password_hash, p_name)
  returning id into new_user_id;

  insert into public.groups (name, is_personal, created_by)
  values ('Personal space', true, new_user_id)
  returning id into personal_group_id;

  insert into public.group_members (group_id, user_id, default_share_weight)
  values (personal_group_id, new_user_id, 1);

  return new_user_id;
end;
$$;

revoke all on function public.register_user(text, text, text) from public, anon, authenticated;
grant execute on function public.register_user(text, text, text) to service_role;
