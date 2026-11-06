-- ensure_personal_spaces walks every user without a personal space and inserts one each (#66).
-- A user deleted between that select and the insert made the whole call fail with a foreign key
-- violation, which the database tests hit when one file's cleanup ran beside the ensure test
-- (#83). A user who is gone needs no personal space, so each user is handled on its own and one
-- that disappears mid-run is skipped. Same name and rights as before; this only replaces the body.
create or replace function public.ensure_personal_spaces()
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
    begin
      insert into public.groups (name, is_personal, created_by)
      values ('Personal space', true, missing.id)
      returning id into personal_group_id;

      insert into public.group_members (group_id, user_id, default_share_weight)
      values (personal_group_id, missing.id, 1);
    exception
      when foreign_key_violation then
        -- The user was deleted after the select; the block's inserts are rolled back and the
        -- loop goes on to the next user.
        null;
    end;
  end loop;
end;
$$;
