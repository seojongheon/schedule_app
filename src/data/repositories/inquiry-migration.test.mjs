import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../../../supabase/migrations/20260718120000_commercial_readiness_foundation.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('inquiry mutations and content reads are implemented as transaction RPCs', () => {
  for (const name of [
    'create_support_inquiry',
    'read_support_inquiry_content',
    'claim_support_inquiry',
    'reply_support_inquiry',
    'change_support_inquiry_status',
    'enqueue_aging_inquiry_notifications',
  ]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${name}\\(`));
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\(`));
  }
});

test('service-only inquiry transactions also enforce service context internally', () => {
  for (const name of [
    'create_support_inquiry',
    'read_support_inquiry_content',
    'claim_support_inquiry',
    'reply_support_inquiry',
    'change_support_inquiry_status',
    'enqueue_aging_inquiry_notifications',
  ]) {
    const start = sql.indexOf(`create or replace function public.${name}(`);
    const end = sql.indexOf('$$;', start);
    assert.ok(start >= 0 && end > start);
    assert.match(sql.slice(start, end), /auth\.role\(\) <> 'service_role'/);
  }
});

test('authenticated roles cannot select encrypted inquiry source tables directly', () => {
  assert.match(sql, /revoke all on public\.support_inquiries, public\.support_inquiry_messages from anon, authenticated;/);
  assert.doesNotMatch(sql, /create policy support_inquiries_admin_metadata/);
});

test('inquiry queue metadata is exposed only through a server-scoped RPC', () => {
  const start = sql.indexOf('create or replace function public.list_support_inquiry_metadata(');
  const end = sql.indexOf('$$;', start);
  assert.ok(start >= 0 && end > start);
  const body = sql.slice(start, end);
  assert.match(body, /inquiry\.read_metadata/);
  assert.doesNotMatch(body, /body_ciphertext|body_iv|body_auth_tag|support_inquiry_messages/);
  assert.match(body, /auth\.role\(\) <> 'service_role'/);
  assert.match(body, /service_actor_has_capability\(p_actor_user_id/);
  assert.match(body, /v_effective_role/);
  assert.match(body, /for share/);
  assert.match(body, /v_effective_role = 'auditor'/);
  assert.match(body, /'effectiveRole', v_effective_role/);
  assert.match(sql, /grant execute on function public\.list_support_inquiry_metadata\(uuid, integer, integer, text\) to service_role;/);
  assert.doesNotMatch(sql, /grant execute on function public\.list_support_inquiry_metadata\([^)]+\) to authenticated;/);
});

test('operations administrators receive the same inquiry metadata capability in SQL as in TypeScript', () => {
  const capabilityStart = sql.indexOf('create or replace function public.has_service_capability');
  const capabilityEnd = sql.indexOf('$$;', capabilityStart);
  const serviceActorStart = sql.indexOf('create or replace function public.service_actor_has_capability');
  const serviceActorEnd = sql.indexOf('$$;', serviceActorStart);
  for (const body of [sql.slice(capabilityStart, capabilityEnd), sql.slice(serviceActorStart, serviceActorEnd)]) {
    assert.match(body, /operations_admin[\s\S]*inquiry\.read_metadata/);
  }
});

test('inquiry route masks rows with the role selected by the locked database transaction', async () => {
  const route = await readFile(new URL('../../app/api/admin/inquiries/route.ts', import.meta.url), 'utf8');
  assert.match(route, /maskAdminRows\(result\.effectiveRole/);
  assert.doesNotMatch(route, /primaryServiceRole\(actor\.roles\)/);
});

test('users may only read notifications and update their read timestamp', () => {
  assert.match(sql, /revoke all on public\.user_notifications from anon, authenticated;/);
  assert.match(sql, /grant select, update \(read_at\) on public\.user_notifications to authenticated;/);
});

test('each authorized content read records a non-content audit event in the same function', () => {
  const start = sql.indexOf('create or replace function public.read_support_inquiry_content(');
  const end = sql.indexOf('$$;', start);
  assert.ok(start >= 0 && end > start);
  const body = sql.slice(start, end);
  assert.match(body, /inquiry\.content_read/);
  assert.match(body, /perform public\.append_audit_event\(/);
  assert.doesNotMatch(body, /first_staff_content_read/);
});

test('reply transaction explicitly rejects closed inquiries', () => {
  const start = sql.indexOf('create or replace function public.reply_support_inquiry(');
  const end = sql.indexOf('$$;', start);
  assert.ok(start >= 0 && end > start);
  assert.match(sql.slice(start, end), /status = 'closed'/);
});

test('aging notifications target only inquiries still waiting on support', () => {
  const start = sql.indexOf('create or replace function public.enqueue_aging_inquiry_notifications(');
  const end = sql.indexOf('$$;', start);
  assert.ok(start >= 0 && end > start);
  assert.match(sql.slice(start, end), /inquiry\.status in \('open', 'in_progress'\)/);
});
