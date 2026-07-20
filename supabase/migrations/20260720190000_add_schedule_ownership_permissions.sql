-- Explicit schedule ownership and role-scoped room operations.

alter table public.schedules
  add column if not exists owner_member_id uuid,
  add column if not exists owner_name_snapshot text,
  add column if not exists created_by_name_snapshot text;

update public.schedules schedule
set owner_member_id = coalesce(
      schedule.created_by_member_id,
      (select member.id from public.room_members member
       where member.room_id = schedule.room_id and member.role = 'owner' limit 1)
    ),
    owner_name_snapshot = coalesce(
      (select member.nickname from public.room_members member where member.id = schedule.created_by_member_id),
      (select member.nickname from public.room_members member
       where member.room_id = schedule.room_id and member.role = 'owner' limit 1),
      '사용자'
    ),
    created_by_name_snapshot = coalesce(
      (select member.nickname from public.room_members member where member.id = schedule.created_by_member_id),
      (select member.nickname from public.room_members member
       where member.room_id = schedule.room_id and member.role = 'owner' limit 1),
      '사용자'
    )
where schedule.owner_member_id is null
   or schedule.owner_name_snapshot is null
   or schedule.created_by_name_snapshot is null;

alter table public.schedules
  drop constraint if exists schedules_created_by_member_id_fkey,
  alter column created_by_member_id drop not null,
  alter column owner_member_id set not null,
  alter column owner_name_snapshot set not null,
  alter column created_by_name_snapshot set not null,
  add constraint schedules_created_by_member_id_fkey
    foreign key (created_by_member_id) references public.room_members(id) on delete set null,
  add constraint schedules_owner_member_id_fkey
    foreign key (owner_member_id) references public.room_members(id),
  add constraint schedules_owner_name_snapshot_check
    check (char_length(trim(owner_name_snapshot)) between 1 and 80),
  add constraint schedules_created_by_name_snapshot_check
    check (char_length(trim(created_by_name_snapshot)) between 1 and 80);

create index if not exists schedules_owner_member_id_idx
  on public.schedules(owner_member_id);

create or replace function public.validate_schedule_room_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_schedule_room_id uuid;
  v_member_room_id uuid;
  v_owner_role text;
begin
  if tg_table_name = 'schedules' then
    if tg_op = 'UPDATE' and new.room_id <> old.room_id then
      raise exception 'Schedule room cannot be changed.';
    end if;

    if new.created_by_member_id is not null then
      select room_id into v_member_room_id
      from public.room_members
      where id = new.created_by_member_id;

      if v_member_room_id is null or v_member_room_id <> new.room_id then
        raise exception 'Schedule creator must belong to the schedule room.';
      end if;
    end if;

    select room_id, role into v_member_room_id, v_owner_role
    from public.room_members
    where id = new.owner_member_id;

    if v_member_room_id is null or v_member_room_id <> new.room_id or v_owner_role = 'viewer' then
      raise exception 'Schedule owner must be an eligible member of the schedule room.';
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

drop trigger if exists schedules_validate_room_integrity on public.schedules;
create trigger schedules_validate_room_integrity
before insert or update of room_id, created_by_member_id, owner_member_id on public.schedules
for each row execute function public.validate_schedule_room_integrity();

create or replace function public.prevent_schedule_protected_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.schedule_transition', true) is distinct from 'allowed'
     and (
       new.room_id is distinct from old.room_id
       or new.owner_member_id is distinct from old.owner_member_id
       or new.owner_name_snapshot is distinct from old.owner_name_snapshot
       or new.created_by_member_id is distinct from old.created_by_member_id
       or new.created_by_name_snapshot is distinct from old.created_by_name_snapshot
     ) then
    raise exception 'Protected schedule fields require a dedicated operation.';
  end if;
  return new;
end;
$$;

drop trigger if exists schedules_prevent_protected_change on public.schedules;
create trigger schedules_prevent_protected_change
before update on public.schedules
for each row execute function public.prevent_schedule_protected_change();

create or replace function public.save_room_schedule(
  p_schedule_id uuid,
  p_room_id uuid,
  p_owner_member_id uuid,
  p_title text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_address text,
  p_customer_phone text,
  p_estimated_price numeric,
  p_additional_info text,
  p_participant_member_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_member_id uuid;
  v_actor_role text;
  v_actor_name text;
  v_owner_role text;
  v_owner_name text;
  v_existing public.schedules%rowtype;
  v_schedule_id uuid;
  v_participant_ids uuid[];
begin
  if auth.uid() is null or not public.is_active_account(auth.uid()) then
    raise exception 'An active account is required.' using errcode = '42501';
  end if;

  select id, role, nickname into v_actor_member_id, v_actor_role, v_actor_name
  from public.room_members
  where room_id = p_room_id and user_id = auth.uid()
  for update;

  if v_actor_member_id is null or v_actor_role not in ('owner', 'manager', 'member') then
    raise exception 'Schedule creation is not allowed for this room role.' using errcode = '42501';
  end if;

  select role, nickname into v_owner_role, v_owner_name
  from public.room_members
  where id = p_owner_member_id and room_id = p_room_id
  for update;

  if v_owner_role is null or v_owner_role = 'viewer' then
    raise exception 'The selected schedule owner is not eligible.' using errcode = '22023';
  end if;

  if v_actor_role = 'member' and p_owner_member_id <> v_actor_member_id then
    raise exception 'Members may create only their own schedules.' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_title, ''))) < 1
     or p_end_at <= p_start_at
     or p_estimated_price is not null and p_estimated_price < 0 then
    raise exception 'Schedule input is invalid.' using errcode = '22023';
  end if;

  v_participant_ids := array(
    select distinct participant_id
    from unnest(coalesce(p_participant_member_ids, '{}'::uuid[]) || array[p_owner_member_id]) participant_id
  );

  if exists (
    select 1
    from unnest(v_participant_ids) participant_id
    left join public.room_members member
      on member.id = participant_id and member.room_id = p_room_id
    where member.id is null
  ) then
    raise exception 'Every participant must belong to the schedule room.' using errcode = '22023';
  end if;

  if v_actor_role = 'member'
     and exists (select 1 from unnest(v_participant_ids) participant_id where participant_id <> v_actor_member_id) then
    raise exception 'Members may add only themselves as participants.' using errcode = '42501';
  end if;

  perform set_config('app.schedule_transition', 'allowed', true);

  if p_schedule_id is null then
    insert into public.schedules(
      room_id, title, start_at, end_at, address, customer_phone,
      estimated_price, additional_info, status, created_by_member_id,
      created_by_name_snapshot, owner_member_id, owner_name_snapshot
    ) values (
      p_room_id, trim(p_title), p_start_at, p_end_at, nullif(trim(p_address), ''),
      nullif(trim(p_customer_phone), ''), p_estimated_price, nullif(trim(p_additional_info), ''),
      'scheduled', v_actor_member_id, v_actor_name, p_owner_member_id, v_owner_name
    ) returning id into v_schedule_id;
  else
    select * into v_existing from public.schedules where id = p_schedule_id for update;

    if not found or v_existing.room_id <> p_room_id then
      raise exception 'Schedule was not found.' using errcode = 'P0002';
    end if;

    if v_existing.owner_member_id <> v_actor_member_id
       or v_existing.owner_member_id <> p_owner_member_id then
      raise exception 'Only the schedule owner may edit it.' using errcode = '42501';
    end if;

    update public.schedules
    set title = trim(p_title),
        start_at = p_start_at,
        end_at = p_end_at,
        address = nullif(trim(p_address), ''),
        customer_phone = nullif(trim(p_customer_phone), ''),
        estimated_price = p_estimated_price,
        additional_info = nullif(trim(p_additional_info), '')
    where id = p_schedule_id
    returning id into v_schedule_id;
  end if;

  delete from public.schedule_participants where schedule_id = v_schedule_id;
  insert into public.schedule_participants(schedule_id, room_member_id)
  select v_schedule_id, participant_id from unnest(v_participant_ids) participant_id;

  return v_schedule_id;
end;
$$;

create or replace function public.delete_room_schedule(p_schedule_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_owner_member_id uuid;
  v_owner_user_id uuid;
  v_owner_role text;
  v_actor_role text;
begin
  if auth.uid() is null or not public.is_active_account(auth.uid()) then
    raise exception 'An active account is required.' using errcode = '42501';
  end if;

  select schedule.room_id, schedule.owner_member_id, owner_member.user_id, owner_member.role
    into v_room_id, v_owner_member_id, v_owner_user_id, v_owner_role
  from public.schedules schedule
  join public.room_members owner_member on owner_member.id = schedule.owner_member_id
  where schedule.id = p_schedule_id
  for update of schedule;

  if v_room_id is null then
    raise exception 'Schedule was not found.' using errcode = 'P0002';
  end if;

  select role into v_actor_role
  from public.room_members
  where room_id = v_room_id and user_id = auth.uid();

  if v_owner_user_id <> auth.uid()
     and not (v_actor_role in ('owner', 'manager') and v_owner_role = 'member') then
    raise exception 'Schedule deletion is not allowed.' using errcode = '42501';
  end if;

  delete from public.schedules where id = p_schedule_id;
  return true;
end;
$$;

create or replace function public.update_room_schedule_status(p_schedule_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.is_active_account(auth.uid())
     or p_status not in ('scheduled', 'completed', 'cancelled')
     or not exists (
       select 1
       from public.schedules schedule
       join public.room_members owner_member on owner_member.id = schedule.owner_member_id
       where schedule.id = p_schedule_id and owner_member.user_id = auth.uid()
     ) then
    raise exception 'Only the schedule owner may change its status.' using errcode = '42501';
  end if;

  update public.schedules set status = p_status where id = p_schedule_id;
  return found;
end;
$$;

create or replace function public.kick_room_member(p_room_id uuid, p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_member_id uuid;
  v_target_role text;
  v_schedule_ids uuid[];
begin
  if auth.uid() is null or not public.is_active_account(auth.uid()) then
    raise exception 'An active account is required.' using errcode = '42501';
  end if;

  select id into v_owner_member_id
  from public.room_members
  where room_id = p_room_id and user_id = auth.uid() and role = 'owner'
  for update;

  select role into v_target_role
  from public.room_members
  where id = p_member_id and room_id = p_room_id
  for update;

  if v_owner_member_id is null or v_target_role is null or v_target_role = 'owner' then
    raise exception 'Only the room owner may remove a non-owner member.' using errcode = '42501';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_schedule_ids
  from public.schedules where owner_member_id = p_member_id;

  perform set_config('app.schedule_transition', 'allowed', true);
  update public.schedules
  set owner_member_id = v_owner_member_id,
      owner_name_snapshot = public.schedules.owner_name_snapshot
  where owner_member_id = p_member_id;

  insert into public.schedule_participants(schedule_id, room_member_id)
  select schedule_id, v_owner_member_id from unnest(v_schedule_ids) schedule_id
  on conflict (schedule_id, room_member_id) do nothing;

  delete from public.room_members where id = p_member_id and room_id = p_room_id;
  return found;
end;
$$;

alter table public.invitation_attempts
  drop constraint if exists invitation_attempts_event_type_check;
alter table public.invitation_attempts
  add constraint invitation_attempts_event_type_check
  check (event_type in ('preview', 'validate', 'redeem', 'create', 'revoke', 'replace', 'deny'));

revoke insert, update, delete on public.schedules from authenticated;
revoke insert, update, delete on public.schedule_participants from authenticated;
revoke delete on public.room_members from authenticated;

revoke all on function public.save_room_schedule(uuid, uuid, uuid, text, timestamptz, timestamptz, text, text, numeric, text, uuid[]) from public, anon;
revoke all on function public.delete_room_schedule(uuid) from public, anon;
revoke all on function public.update_room_schedule_status(uuid, text) from public, anon;
revoke all on function public.kick_room_member(uuid, uuid) from public, anon;
grant execute on function public.save_room_schedule(uuid, uuid, uuid, text, timestamptz, timestamptz, text, text, numeric, text, uuid[]) to authenticated;
grant execute on function public.delete_room_schedule(uuid) to authenticated;
grant execute on function public.update_room_schedule_status(uuid, text) to authenticated;
grant execute on function public.kick_room_member(uuid, uuid) to authenticated;
