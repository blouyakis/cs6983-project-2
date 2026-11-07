-- A former member who is invited again joins from now, at weight 1 (#6). They keep one row, so
-- joined_at becomes the time of this join. now() is the database's clock, the same one that
-- stamps left_at, created_at and every other cut-off, so a clock difference between the app
-- server and the database can't move the edge of what they see (#75). A user who isn't a former
-- member is left as they are. The 12-member trigger still rejects a 13th current member.
-- TODO(#63): give the newcomer the shared weight when every weight is equal, or reset the group
-- to 1 when they differ.
create function public.rejoin_member(
  p_group_id uuid,
  p_user_id uuid
)
returns void
language sql
set search_path = ''
as $$
  update public.group_members
  set left_at = null,
      joined_at = now(),
      default_share_weight = 1
  where group_id = p_group_id
    and user_id = p_user_id
    and left_at is not null;
$$;

revoke all on function public.rejoin_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rejoin_member(uuid, uuid) to service_role;
