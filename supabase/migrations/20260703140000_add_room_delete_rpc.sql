create or replace function public.delete_scheduling_room(
  p_room_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if public.current_room_role(p_room_id) <> 'owner' then
    raise exception 'Only the room owner can delete this room.';
  end if;

  delete from public.schedules
  where room_id = p_room_id;

  update public.room_members
  set role = 'manager'
  where room_id = p_room_id
    and role = 'owner';

  delete from public.scheduling_rooms
  where id = p_room_id;

  if found = false then
    raise exception 'Room was not found.';
  end if;
end;
$$;
