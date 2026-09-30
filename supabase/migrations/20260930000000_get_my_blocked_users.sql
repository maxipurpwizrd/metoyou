create or replace function public.get_my_blocked_users()
returns table (
  id uuid,
  username text,
  profile_pic text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_user_id, p.username, p.profile_pic
  from public.user_blocks as b
  left join public.profiles as p on p.id = b.blocked_user_id
  where b.blocker_user_id = auth.uid()
  order by b.created_at desc, b.blocked_user_id asc;
$$;

alter function public.get_my_blocked_users() owner to postgres;

revoke all privileges on function public.get_my_blocked_users() from public, anon, service_role;
grant execute on function public.get_my_blocked_users() to authenticated;