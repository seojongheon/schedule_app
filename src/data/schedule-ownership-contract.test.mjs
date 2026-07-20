import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../../supabase/migrations/20260720190000_add_schedule_ownership_permissions.sql', import.meta.url);
const loaderUrl = new URL('./schedule-supabase.ts', import.meta.url);
const actionsUrl = new URL('../app/actions/schedule-actions.ts', import.meta.url);
const entitiesUrl = new URL('../domain/entities.ts', import.meta.url);
const databaseTypesUrl = new URL('./database.types.ts', import.meta.url);

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

test('application types and loader expose schedule ownership snapshots', async () => {
  const [loader, entities, databaseTypes] = await Promise.all([
    readFile(loaderUrl, 'utf8'),
    readFile(entitiesUrl, 'utf8'),
    readFile(databaseTypesUrl, 'utf8'),
  ]);

  assert.match(loader, /owner_member_id,owner_name_snapshot,created_by_member_id,created_by_name_snapshot/);
  assert.match(loader, /ownerMemberId:\s*schedule\.owner_member_id/);
  assert.match(loader, /ownerName:\s*schedule\.owner_name_snapshot/);
  assert.match(loader, /createdByName:\s*schedule\.created_by_name_snapshot/);
  assert.match(entities, /ownerMemberId:\s*string/);
  assert.match(entities, /ownerName:\s*string/);
  assert.match(entities, /createdByMemberId:\s*string\s*\|\s*null/);
  assert.match(entities, /createdByName:\s*string/);
  for (const name of ['save_room_schedule', 'delete_room_schedule', 'update_room_schedule_status', 'kick_room_member']) {
    assert.match(databaseTypes, new RegExp(`${name}:`));
  }
});

test('schedule and kick actions delegate atomic work to ownership RPCs', async () => {
  const actions = await readFile(actionsUrl, 'utf8');

  assert.match(actions, /rpc\('save_room_schedule'/);
  assert.match(actions, /rpc\('delete_room_schedule'/);
  assert.match(actions, /rpc\('update_room_schedule_status'/);
  assert.match(actions, /rpc\('kick_room_member'/);
  assert.doesNotMatch(actions, /from\('schedule_participants'\)\.delete/);
  assert.doesNotMatch(actions, /from\('room_members'\)\.delete/);
});
