-- A personal space keeps its name, its owner and its kind (#23). The members trigger keeps anyone
-- but the owner out of it; this keeps the groups row from undoing that. created_by can't hand it to
-- someone else, is_personal can't turn it into a shared group or a shared group into one, and its
-- name stays the fixed "Personal space" that register_user writes, through update_group or not.
create function public.enforce_personal_space_fixed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_personal is distinct from old.is_personal
    or (old.is_personal and (
      new.name is distinct from old.name
      or new.created_by is distinct from old.created_by
    ))
  then
    raise exception 'A personal space keeps its name, its owner and its kind.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger groups_personal_space_fixed
before update of name, is_personal, created_by on public.groups
for each row
execute function public.enforce_personal_space_fixed();

revoke all on function public.enforce_personal_space_fixed() from public, anon, authenticated;
