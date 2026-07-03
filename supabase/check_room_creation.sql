-- Supabase SQL Editor에서 그대로 실행하세요.
-- 방 생성이 안 될 때 RPC, 권한, 프로필, 최근 데이터 상태를 확인합니다.

select
  routine_name,
  routine_type,
  data_type
from information_schema.routines
where specific_schema = 'public'
  and routine_name in (
    'ensure_current_profile',
    'generate_invite_code',
    'create_scheduling_room',
    'join_room_by_invite',
    'set_room_manager_role',
    'transfer_room_ownership'
  )
order by routine_name;

select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee in ('authenticated', 'anon')
  and routine_name in (
    'ensure_current_profile',
    'generate_invite_code',
    'create_scheduling_room',
    'join_room_by_invite',
    'set_room_manager_role',
    'transfer_room_ownership'
  )
order by routine_name, grantee;

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'scheduling_rooms', 'room_members', 'room_invites')
order by tablename, policyname;

select
  'profiles' as table_name,
  count(*) as row_count
from public.profiles
union all
select
  'scheduling_rooms',
  count(*)
from public.scheduling_rooms
union all
select
  'room_members',
  count(*)
from public.room_members
union all
select
  'room_invites',
  count(*)
from public.room_invites;

select
  id,
  email,
  name,
  is_service_admin,
  status,
  created_at
from public.profiles
order by created_at desc
limit 10;

select
  id,
  name,
  owner_user_id,
  created_at,
  updated_at
from public.scheduling_rooms
order by created_at desc
limit 10;
