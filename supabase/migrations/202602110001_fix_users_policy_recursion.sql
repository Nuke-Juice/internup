-- Fix recursive RLS evaluation on public.users.
--
-- Root cause:
-- - users_update_access WITH CHECK selected from public.users, which recursively
--   re-entered the same policy during UPDATE/UPSERT.
-- - public.is_admin_user(uid) also queries public.users and can recurse through
--   users policies unless row_security is disabled inside the definer function.

create or replace function public.is_admin_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.users u
    where u.id = uid
      and u.role in ('ops_admin', 'super_admin')
  );
$$;

create or replace function public.prevent_unauthorized_user_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uid uuid := (select auth.uid());
  actor_role text := (select auth.role());
begin
  if new.role is distinct from old.role then
    if actor_role = 'service_role' or actor_uid is null or public.is_admin_user(actor_uid) then
      return new;
    end if;

    raise exception 'users.role may only be changed by an admin';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_unauthorized_user_role_change on public.users;
create trigger prevent_unauthorized_user_role_change
before update on public.users
for each row
execute function public.prevent_unauthorized_user_role_change();

drop policy if exists users_update_access on public.users;
create policy users_update_access
  on public.users
  for update
  to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );
