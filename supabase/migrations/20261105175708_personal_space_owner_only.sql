-- A personal space has exactly one member, its owner (architecture.md Section 4, #23).
-- inviteMember refuses invitations to it, but this trigger makes the database the last word:
-- no one else can join, be moved in from another group, or take over the owner's membership.
create function public.enforce_personal_space_owner_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.groups
    where id = new.group_id
      and is_personal
      and created_by <> new.user_id
  ) then
    raise exception 'A personal space has only its owner as a member.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger group_members_personal_space_owner_only
before insert or update of group_id, user_id on public.group_members
for each row
execute function public.enforce_personal_space_owner_only();

revoke all on function public.enforce_personal_space_owner_only() from public, anon, authenticated;
