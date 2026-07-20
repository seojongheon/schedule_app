import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../../supabase/migrations/20260720190000_add_schedule_ownership_permissions.sql', import.meta.url);

test('schedule ownership migration adds explicit ownership and atomic mutation RPCs', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /add column(?: if not exists)? owner_member_id uuid/i);
  assert.match(sql, /add column(?: if not exists)? owner_name_snapshot text/i);
  assert.match(sql, /add column(?: if not exists)? created_by_name_snapshot text/i);
  assert.match(sql, /foreign key \(created_by_member_id\)[\s\S]*on delete set null/i);
  assert.match(sql, /create or replace function public\.save_room_schedule\(/i);
  assert.match(sql, /create or replace function public\.delete_room_schedule\(/i);
  assert.match(sql, /create or replace function public\.update_room_schedule_status\(/i);
  assert.match(sql, /create or replace function public\.kick_room_member\(/i);
  assert.match(sql, /v_actor_role = 'member'[\s\S]*p_owner_member_id <> v_actor_member_id/i);
  assert.match(sql, /v_owner_role = 'member'/i);
  assert.match(sql, /set owner_member_id = v_owner_member_id[\s\S]*owner_name_snapshot/i);
  assert.match(sql, /event_type in \('preview', 'validate', 'redeem', 'create', 'revoke', 'replace', 'deny'\)/i);
});

test('direct schedule mutations are replaced by authenticated RPC execution', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /revoke insert, update, delete on public\.schedules from authenticated/i);
  assert.match(sql, /revoke insert, update, delete on public\.schedule_participants from authenticated/i);
  for (const name of ['save_room_schedule', 'delete_room_schedule', 'update_room_schedule_status', 'kick_room_member']) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(`, 'i'));
  }
});
