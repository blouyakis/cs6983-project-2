-- MAX_GROUP_MEMBERS = 12 (AGENTS.md Section 6.5): the settle-up search is exact, so groups stay small.
create function public.enforce_max_group_members()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_members integer;
begin
  -- A row that is leaving, or was inserted as a former member, never adds a current member.
  if new.left_at is not null then
    return new;
  end if;
  -- A current member who stays in the same group is already counted.
  if tg_op = 'UPDATE' and old.left_at is null and old.group_id = new.group_id then
    return new;
  end if;

  -- Lock the group so two concurrent joins cannot both see 11 members.
  perform 1 from public.groups where id = new.group_id for update;

  select count(*) into current_members
  from public.group_members
  where group_id = new.group_id
    and left_at is null;

  if current_members >= 12 then
    raise exception 'A group can have at most 12 current members.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger group_members_max_twelve
before insert or update of group_id, left_at on public.group_members
for each row
execute function public.enforce_max_group_members();

revoke all on function public.enforce_max_group_members() from public, anon, authenticated;
