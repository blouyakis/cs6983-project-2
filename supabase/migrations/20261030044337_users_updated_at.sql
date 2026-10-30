-- updated_at belongs to the database: every update sets it, and a value sent by the caller is ignored.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

revoke all on function public.set_updated_at() from public, anon, authenticated;
