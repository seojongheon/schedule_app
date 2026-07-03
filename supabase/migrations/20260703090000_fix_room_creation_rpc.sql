create or replace function public.ensure_current_profile(p_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  v_email := coalesce(auth.jwt() ->> 'email', auth.uid()::text || '@unknown.local');
  v_name := coalesce(
    nullif(trim(p_name), ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    nullif(split_part(v_email, '@', 1), ''),
    '사용자'
  );

  insert into public.profiles (id, email, name, status)
  values (auth.uid(), v_email, v_name, 'active')
  on conflict (id) do nothing;
end;
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

  perform public.ensure_current_profile(p_nickname);

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

grant execute on function public.ensure_current_profile(text) to authenticated;
grant execute on function public.generate_invite_code() to authenticated;
grant execute on function public.create_scheduling_room(text, text, text, text, text, text, time, time) to authenticated;
grant execute on function public.join_room_by_invite(text, text, text) to authenticated;
grant execute on function public.set_room_manager_role(uuid, uuid, boolean) to authenticated;
grant execute on function public.transfer_room_ownership(uuid, uuid) to authenticated;
