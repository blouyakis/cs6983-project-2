-- Every account has a personal space (#66): registration creates one through register_user, but
-- until #66 the register service inserted the user directly, so accounts from before have none.
-- This function gives one to every user without one, exactly as register_user does, and does
-- nothing for users who have one. The migration calls it once to backfill; it stays callable
-- (service_role only) so the backfill can be repeated safely.
create function public.ensure_personal_spaces()
returns void
language plpgsql
set search_path = ''
as $$
declare
  missing record;
  personal_group_id uuid;
begin
  for missing in
    select u.id
    from public.users as u
    where not exists (
      select 1
      from public.groups as g
      where g.created_by = u.id
        and g.is_personal
    )
    order by u.created_at
  loop
    insert into public.groups (name, is_personal, created_by)
    values ('Personal space', true, missing.id)
    returning id into personal_group_id;

    insert into public.group_members (group_id, user_id, default_share_weight)
    values (personal_group_id, missing.id, 1);
  end loop;
end;
$$;

revoke all on function public.ensure_personal_spaces() from public, anon, authenticated;
grant execute on function public.ensure_personal_spaces() to service_role;

select public.ensure_personal_spaces();
