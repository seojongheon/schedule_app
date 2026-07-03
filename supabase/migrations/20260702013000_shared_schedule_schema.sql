create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  phone text,
  is_service_admin boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table public.scheduling_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text not null default '#3558e6',
  shared_schedule_color text not null default '#8b6ff4',
  owner_user_id uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active', 'archived')),
  default_view text not null default 'week' check (default_view in ('week', 'month')),
  business_start_time time not null default '09:00',
  business_end_time time not null default '18:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.scheduling_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null,
  role text not null default 'member' check (role in ('owner', 'manager', 'member')),
  color text not null default '#3558e6',
  joined_at timestamptz not null default now(),
  last_active_at timestamptz,
  unique (room_id, user_id),
  unique (room_id, nickname)
);

create unique index room_members_one_owner_per_room
  on public.room_members(room_id)
  where role = 'owner';

create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.scheduling_rooms(id) on delete cascade,
  code text not null unique,
  created_by_user_id uuid not null references public.profiles(id),
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.scheduling_rooms(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  address text,
  customer_phone text,
  estimated_price numeric,
  additional_info text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_by_member_id uuid not null references public.room_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table public.schedule_participants (
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  room_member_id uuid not null references public.room_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (schedule_id, room_member_id)
);

create table public.schedule_user_states (
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_checked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (schedule_id, user_id)
);

create table public.preliminary_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.scheduling_rooms(id) on delete set null,
  title text not null,
  memo text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default false,
  default_calendar_view text not null default 'week' check (default_calendar_view in ('week', 'month')),
  filter_opacity integer not null default 25 check (filter_opacity between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scheduling_rooms_owner_user_id_idx on public.scheduling_rooms(owner_user_id);
create index room_members_room_id_idx on public.room_members(room_id);
create index room_members_user_id_idx on public.room_members(user_id);
create index room_invites_room_id_idx on public.room_invites(room_id);
create index schedules_room_id_start_at_idx on public.schedules(room_id, start_at);
create index schedules_created_by_member_id_idx on public.schedules(created_by_member_id);
create index schedule_participants_room_member_id_idx on public.schedule_participants(room_member_id);
create index preliminary_tasks_user_id_due_date_idx on public.preliminary_tasks(user_id, due_date);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger scheduling_rooms_touch_updated_at
before update on public.scheduling_rooms
for each row execute function public.touch_updated_at();

create trigger schedules_touch_updated_at
before update on public.schedules
for each row execute function public.touch_updated_at();

create trigger schedule_user_states_touch_updated_at
before update on public.schedule_user_states
for each row execute function public.touch_updated_at();

create trigger preliminary_tasks_touch_updated_at
before update on public.preliminary_tasks
for each row execute function public.touch_updated_at();

create trigger user_preferences_touch_updated_at
before update on public.user_preferences
for each row execute function public.touch_updated_at();

create or replace function public.validate_schedule_room_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule_room_id uuid;
  v_member_room_id uuid;
begin
  if tg_table_name = 'schedules' then
    if tg_op = 'UPDATE' and new.room_id <> old.room_id then
      raise exception 'Schedule room cannot be changed.';
    end if;

    select room_id into v_member_room_id
    from public.room_members
    where id = new.created_by_member_id;

    if v_member_room_id is null or v_member_room_id <> new.room_id then
      raise exception 'Schedule creator must be a member of the schedule room.';
    end if;

    return new;
  end if;

  if tg_table_name = 'schedule_participants' then
    select room_id into v_schedule_room_id
    from public.schedules
    where id = new.schedule_id;

    select room_id into v_member_room_id
    from public.room_members
    where id = new.room_member_id;

    if v_schedule_room_id is null or v_member_room_id is null or v_schedule_room_id <> v_member_room_id then
      raise exception 'Schedule participant must belong to the same room as the schedule.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

create trigger schedules_validate_room_integrity
before insert or update of room_id, created_by_member_id on public.schedules
for each row execute function public.validate_schedule_room_integrity();

create trigger schedule_participants_validate_room_integrity
before insert or update of schedule_id, room_member_id on public.schedule_participants
for each row execute function public.validate_schedule_room_integrity();

create or replace function public.prevent_room_member_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.room_id <> old.room_id then
    raise exception 'Room member room cannot be changed.';
  end if;

  if new.user_id <> old.user_id then
    raise exception 'Room member user cannot be changed.';
  end if;

  if new.joined_at <> old.joined_at then
    raise exception 'Room member joined_at cannot be changed.';
  end if;

  return new;
end;
$$;

create trigger room_members_prevent_identity_change
before update on public.room_members
for each row execute function public.prevent_room_member_identity_change();

create or replace function public.prevent_owner_member_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role = 'owner' then
    raise exception 'Room owner must transfer ownership before leaving or being removed.';
  end if;

  return old;
end;
$$;

create trigger room_members_prevent_owner_delete
before delete on public.room_members
for each row execute function public.prevent_owner_member_delete();

create or replace function public.is_service_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_service_admin = true
      and status = 'active'
  );
$$;

create or replace function public.prevent_profile_protected_field_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() = old.id then
    if new.email <> old.email then
      raise exception 'Profile email cannot be changed by the user.';
    end if;

    if new.is_service_admin <> old.is_service_admin then
      raise exception 'Service administrator flag cannot be changed by the user.';
    end if;

    if new.status <> old.status then
      raise exception 'Account status cannot be changed by the user.';
    end if;

    if new.created_at <> old.created_at then
      raise exception 'Profile created_at cannot be changed by the user.';
    end if;

    if new.last_login_at is distinct from old.last_login_at then
      raise exception 'Profile last_login_at cannot be changed by the user.';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_prevent_protected_field_change
before update on public.profiles
for each row execute function public.prevent_profile_protected_field_change();

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.current_room_role(p_room_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select role
  from public.room_members
  where room_id = p_room_id
    and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.can_manage_room_schedules(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(public.current_room_role(p_room_id) in ('owner', 'manager'), false);
$$;

create or replace function public.is_schedule_participant(p_schedule_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.schedule_participants sp
    join public.room_members rm on rm.id = sp.room_member_id
    where sp.schedule_id = p_schedule_id
      and rm.user_id = auth.uid()
  );
$$;

create or replace function public.generate_invite_code()
returns text
language sql
as $$
  select upper(
    substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4)
    || '-'
    || substr(encode(extensions.gen_random_bytes(2), 'hex'), 1, 2)
  );
$$;

create or replace function public.create_scheduling_room(
  p_name text,
  p_description text,
  p_nickname text,
  p_color text,
  p_shared_schedule_color text,
  p_default_view text,
  p_business_start_time time,
  p_business_end_time time
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_member_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  insert into public.scheduling_rooms (
    name,
    description,
    color,
    shared_schedule_color,
    owner_user_id,
    default_view,
    business_start_time,
    business_end_time
  )
  values (
    p_name,
    p_description,
    p_color,
    p_shared_schedule_color,
    auth.uid(),
    p_default_view,
    p_business_start_time,
    p_business_end_time
  )
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id, nickname, role, color)
  values (v_room_id, auth.uid(), p_nickname, 'owner', p_color)
  returning id into v_member_id;

  loop
    v_code := public.generate_invite_code();
    exit when not exists (select 1 from public.room_invites where code = v_code);
  end loop;

  insert into public.room_invites (room_id, code, created_by_user_id)
  values (v_room_id, v_code, auth.uid());

  insert into public.user_preferences (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  return jsonb_build_object(
    'room_id', v_room_id,
    'member_id', v_member_id,
    'invite_code', v_code
  );
end;
$$;

create or replace function public.join_room_by_invite(
  p_code text,
  p_nickname text,
  p_color text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.room_invites%rowtype;
  v_room public.scheduling_rooms%rowtype;
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_invite
  from public.room_invites
  where code = upper(trim(p_code))
  for update;

  if not found or v_invite.is_active = false then
    raise exception 'Invalid invite code.';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite code has expired.';
  end if;

  if v_invite.max_uses is not null and v_invite.used_count >= v_invite.max_uses then
    raise exception 'Invite code has reached its usage limit.';
  end if;

  select * into v_room
  from public.scheduling_rooms
  where id = v_invite.room_id;

  if v_room.status <> 'active' then
    raise exception 'Room is inactive.';
  end if;

  if exists (select 1 from public.room_members where room_id = v_invite.room_id and user_id = auth.uid()) then
    raise exception 'Already joined this room.';
  end if;

  if exists (select 1 from public.room_members where room_id = v_invite.room_id and nickname = p_nickname) then
    raise exception 'Nickname already exists in this room.';
  end if;

  insert into public.room_members (room_id, user_id, nickname, role, color)
  values (v_invite.room_id, auth.uid(), p_nickname, 'member', p_color)
  returning id into v_member_id;

  update public.room_invites
  set used_count = used_count + 1
  where id = v_invite.id;

  return jsonb_build_object('room_id', v_invite.room_id, 'member_id', v_member_id);
end;
$$;

create or replace function public.set_room_manager_role(
  p_room_id uuid,
  p_member_id uuid,
  p_is_manager boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_room_role(p_room_id) <> 'owner' then
    raise exception 'Only the room owner can change manager permissions.';
  end if;

  update public.room_members
  set role = case when p_is_manager then 'manager' else 'member' end
  where id = p_member_id
    and room_id = p_room_id
    and role <> 'owner';
end;
$$;

create or replace function public.transfer_room_ownership(
  p_room_id uuid,
  p_new_owner_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_owner_member_id uuid;
  v_new_owner_user_id uuid;
begin
  if public.current_room_role(p_room_id) <> 'owner' then
    raise exception 'Only the room owner can transfer ownership.';
  end if;

  select id into v_current_owner_member_id
  from public.room_members
  where room_id = p_room_id
    and user_id = auth.uid()
    and role = 'owner';

  if p_new_owner_member_id = v_current_owner_member_id then
    raise exception 'New owner must be different from the current owner.';
  end if;

  select user_id into v_new_owner_user_id
  from public.room_members
  where id = p_new_owner_member_id
    and room_id = p_room_id;

  if v_new_owner_user_id is null then
    raise exception 'New owner must be a room member.';
  end if;

  update public.room_members
  set role = 'manager'
  where id = v_current_owner_member_id;

  update public.room_members
  set role = 'owner'
  where id = p_new_owner_member_id;

  update public.scheduling_rooms
  set owner_user_id = v_new_owner_user_id,
      updated_at = now()
  where id = p_room_id;

  if (select count(*) from public.room_members where room_id = p_room_id and role = 'owner') <> 1 then
    raise exception 'Room must have exactly one owner.';
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.scheduling_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_invites enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_participants enable row level security;
alter table public.schedule_user_states enable row level security;
alter table public.preliminary_tasks enable row level security;
alter table public.user_preferences enable row level security;

create policy "profiles_select_self_or_service_admin"
on public.profiles for select
using (id = auth.uid() or public.is_service_admin());

create policy "profiles_update_self_limited"
on public.profiles for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and email = (select email from public.profiles where id = auth.uid())
  and is_service_admin = (select is_service_admin from public.profiles where id = auth.uid())
  and status = (select status from public.profiles where id = auth.uid())
  and created_at = (select created_at from public.profiles where id = auth.uid())
  and last_login_at is not distinct from (select last_login_at from public.profiles where id = auth.uid())
);

create policy "profiles_service_admin_all"
on public.profiles for all
using (public.is_service_admin())
with check (public.is_service_admin());

create policy "rooms_select_members"
on public.scheduling_rooms for select
using (public.is_room_member(id));

create policy "rooms_owner_update_delete"
on public.scheduling_rooms for update
using (public.current_room_role(id) = 'owner')
with check (public.current_room_role(id) = 'owner');

create policy "rooms_owner_delete"
on public.scheduling_rooms for delete
using (public.current_room_role(id) = 'owner');

create policy "members_select_same_room"
on public.room_members for select
using (public.is_room_member(room_id));

create policy "members_owner_manage"
on public.room_members for update
using (public.current_room_role(room_id) = 'owner')
with check (public.current_room_role(room_id) = 'owner');

create policy "members_owner_remove"
on public.room_members for delete
using (public.current_room_role(room_id) = 'owner');

create policy "invites_select_room_members"
on public.room_invites for select
using (public.is_room_member(room_id) and is_active = true);

create policy "invites_owner_manage"
on public.room_invites for all
using (public.current_room_role(room_id) = 'owner')
with check (public.current_room_role(room_id) = 'owner');

create policy "schedules_select_room_members"
on public.schedules for select
using (public.is_room_member(room_id));

create policy "schedules_manager_write"
on public.schedules for all
using (public.can_manage_room_schedules(room_id))
with check (
  public.can_manage_room_schedules(room_id)
  and exists (
    select 1
    from public.room_members creator
    where creator.id = created_by_member_id
      and creator.room_id = room_id
  )
);

create policy "schedule_participants_select_room_members"
on public.schedule_participants for select
using (
  exists (
    select 1 from public.schedules s
    where s.id = schedule_id
      and public.is_room_member(s.room_id)
  )
);

create policy "schedule_participants_manager_write"
on public.schedule_participants for all
using (
  exists (
    select 1 from public.schedules s
    where s.id = schedule_id
      and public.can_manage_room_schedules(s.room_id)
  )
)
with check (
  exists (
    select 1
    from public.schedules s
    join public.room_members rm on rm.id = room_member_id
    where s.id = schedule_id
      and rm.room_id = s.room_id
      and public.can_manage_room_schedules(s.room_id)
  )
);

create policy "schedule_user_states_self"
on public.schedule_user_states for all
using (
  user_id = auth.uid()
  and public.is_schedule_participant(schedule_id)
)
with check (
  user_id = auth.uid()
  and public.is_schedule_participant(schedule_id)
);

create policy "preliminary_tasks_self"
on public.preliminary_tasks for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (room_id is null or public.is_room_member(room_id))
);

create policy "user_preferences_self"
on public.user_preferences for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
