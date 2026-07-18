import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import test from 'node:test';

register('./alias-loader.mjs', import.meta.url);
const { createInviteRepository } = await import('./invite-repository.ts');
const migrationUrl = new URL('../../../supabase/migrations/20260718120000_commercial_readiness_foundation.sql', import.meta.url);

function fakeClient(responses = {}) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      return responses[name] ?? { data: null, error: null };
    },
  };
}

test('replacement atomically creates a new opaque token and supplies the protected RPC arguments', async () => {
  const client = fakeClient({ replace_room_invite: { data: 'invite-new', error: null } });
  const repository = createInviteRepository(client);

  const result = await repository.replace({
    roomId: '00000000-0000-4000-8000-000000000009',
    inviteId: '00000000-0000-4000-8000-000000000001',
    expiresAt: '2026-07-20T12:00:00.000Z',
    maxUses: 3,
    reason: '링크 노출 가능성 확인',
    ipKey: 'ip-hmac',
    requestId: 'request-0001',
    actorUserId: '00000000-0000-4000-8000-000000000002',
  });

  assert.equal(result.inviteId, 'invite-new');
  assert.match(result.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(client.calls[0].name, 'replace_room_invite');
  assert.deepEqual(client.calls[0].args, {
    p_room_id: '00000000-0000-4000-8000-000000000009',
    p_invite_id: '00000000-0000-4000-8000-000000000001',
    p_token_hash: client.calls[0].args.p_token_hash,
    p_token_hint: result.token.slice(-6),
    p_expires_at: '2026-07-20T12:00:00.000Z',
    p_max_uses: 3,
    p_reason: '링크 노출 가능성 확인',
    p_ip_key: 'ip-hmac',
    p_request_id: 'request-0001',
    p_actor_user_id: '00000000-0000-4000-8000-000000000002',
  });
  assert.match(client.calls[0].args.p_token_hash, /^[a-f0-9]{64}$/);
});

test('replacement keeps the old invite active when nested creation is denied', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  const start = sql.indexOf('create or replace function public.replace_room_invite(');
  const end = sql.indexOf('$$;', start);
  const body = sql.slice(start, end);
  const createIndex = body.indexOf('v_new_id := public.create_room_invite(');
  const guardIndex = body.indexOf('if v_new_id is null then', createIndex);
  const replaceIndex = body.indexOf("set status = 'replaced'", createIndex);
  assert.ok(createIndex >= 0 && guardIndex > createIndex && replaceIndex > guardIndex);
});

test('repository surfaces protected RPC failures without exposing a raw token', async () => {
  const client = fakeClient({ replace_room_invite: { data: null, error: new Error('not authorized') } });
  const repository = createInviteRepository(client);

  await assert.rejects(
    () => repository.replace({
      roomId: '00000000-0000-4000-8000-000000000009',
      inviteId: '00000000-0000-4000-8000-000000000001',
      expiresAt: '2026-07-20T12:00:00.000Z',
      maxUses: 1,
      reason: '재발급',
      ipKey: 'ip-hmac',
      requestId: 'request-0002',
      actorUserId: '00000000-0000-4000-8000-000000000002',
    }),
    /not authorized/,
  );
});

test('create, preview, redeem, and revoke use only protected token-hash RPC contracts', async () => {
  const client = fakeClient({
    create_room_invite: { data: 'invite-created', error: null },
    preview_room_invite: { data: { result: 'active' }, error: null },
    redeem_room_invite: { data: { result: 'invite_redeemed', room_id: 'room-1' }, error: null },
    revoke_room_invite: { data: true, error: null },
  });
  const repository = createInviteRepository(client);

  const created = await repository.create({
    roomId: 'room-1', grantRole: 'viewer', expiresAt: '2026-07-20T00:00:00Z',
    maxUses: 2, ipKey: 'ip-hmac', requestId: 'request-create',
    actorUserId: 'user-1',
  });
  assert.equal(created.inviteId, 'invite-created');
  assert.equal(typeof created.token, 'string');
  assert.equal(created.token.length > 20, true);

  await repository.preview(created.token, 'ip-hmac', 'request-preview');
  await repository.redeem(created.token, 'nickname', '#112233', 'ip-hmac', 'request-redeem', 'user-1');
  await repository.revoke('room-1', 'invite-created', 'rotated', 'ip-hmac', 'request-revoke', 'user-1');

  assert.deepEqual(client.calls.map((call) => call.name), [
    'create_room_invite', 'preview_room_invite', 'redeem_room_invite', 'revoke_room_invite',
  ]);
  assert.equal('p_token' in client.calls[0].args, false);
  assert.equal(client.calls[0].args.p_ip_key, 'ip-hmac');
  assert.equal(client.calls[3].args.p_ip_key, 'ip-hmac');
  assert.equal(client.calls[0].args.p_actor_user_id, 'user-1');
  assert.equal(client.calls[2].args.p_actor_user_id, 'user-1');
  assert.equal(client.calls[3].args.p_actor_user_id, 'user-1');
  assert.equal(client.calls[1].args.p_token_hash, client.calls[2].args.p_token_hash);
  assert.notEqual(client.calls[1].args.p_token_hash, created.token);
});

test('invitation routes expose only the documented nested mutation endpoints', async () => {
  const [roomRoute, tokenRoute, redeemRoute, revokeRoute, replaceRoute] = await Promise.all([
    readFile(new URL('../../app/api/rooms/[roomId]/invites/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../app/api/invites/[token]/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../app/api/invites/[token]/redeem/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../app/api/rooms/[roomId]/invites/[inviteId]/revoke/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../app/api/rooms/[roomId]/invites/[inviteId]/replace/route.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(roomRoute, /export async function POST|export const POST/);
  assert.doesNotMatch(roomRoute, /export (?:async function|const) (?:DELETE|PATCH)/);
  assert.match(tokenRoute, /withSensitiveRateLimit/);
  assert.match(tokenRoute, /export const GET/);
  assert.doesNotMatch(tokenRoute, /export (?:async function|const) POST/);
  assert.doesNotMatch(tokenRoute, /export async function redeemInviteHandler/);
  assert.match(redeemRoute, /withSensitiveRateLimit/);
  assert.match(redeemRoute, /export const POST/);
  assert.match(redeemRoute, /from ['"]\.\.\/invite-handlers['"]/);
  assert.match(revokeRoute, /export const POST|export async function POST/);
  assert.match(replaceRoute, /export const POST|export async function POST/);
});

test('room workspace and application types contain no reachable reusable plaintext-code flow', async () => {
  const [panel, workspace, actions, scheduleData, entities, mockData, databaseTypes] = await Promise.all([
    readFile(new URL('../../components/app/RoomInvitePanel.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../components/app/ScheduleWorkspace.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/actions/schedule-actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../schedule-supabase.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../domain/entities.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../lib/mock-data.ts', import.meta.url), 'utf8'),
    readFile(new URL('../database.types.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(panel, /export function RoomInvitePanel/);
  assert.match(panel, /fetch\(\`\/api\/rooms\/\$\{encodeURIComponent\(roomId\)\}\/invites\`/);
  assert.match(panel, /\/invites\/\$\{encodeURIComponent\(invite\.inviteId\)\}\/replace/);
  assert.match(panel, /\/invites\/\$\{encodeURIComponent\(invite\.inviteId\)\}\/revoke/);
  assert.match(workspace, /RoomInvitePanel/);
  assert.doesNotMatch(workspace, /joinRoomAction|validateInviteAction|room\.inviteCode|candidate\.inviteCode|초대 코드 복사/);
  assert.doesNotMatch(actions, /join_room_by_invite|\.eq\('code'|regenerateInviteCodeAction|normalizeInviteCode/);
  assert.doesNotMatch(scheduleData, /\.from\('room_invites'\)|inviteByRoomId/);
  assert.doesNotMatch(`${entities}\n${mockData}\n${databaseTypes}`, /inviteCode|join_room_by_invite/);
});

test('join page redeems through the documented endpoint after showing a safe preview', async () => {
  const joinPage = await readFile(new URL('../../app/join/[token]/page.tsx', import.meta.url), 'utf8');
  assert.match(joinPage, /\/api\/invites\/\$\{encodeURIComponent\(token\)\}\/redeem/);
  assert.match(joinPage, /preview\.result !== 'active'/);
  assert.match(joinPage, /roomId/);
  assert.doesNotMatch(joinPage, /room_id|ownerNickname|memberCount/);
});

test('commercial migration replaces legacy creation and joining without plaintext invitations', async () => {
  const migration = await readFile(new URL('../../../supabase/migrations/20260718120000_commercial_readiness_foundation.sql', import.meta.url), 'utf8');
  const roomCreationStart = migration.lastIndexOf('create or replace function public.create_scheduling_room');
  const roomCreationEnd = migration.indexOf('$$;', roomCreationStart);
  const roomCreation = migration.slice(roomCreationStart, roomCreationEnd);

  assert.ok(roomCreationStart > 0, 'commercial migration must replace create_scheduling_room');
  assert.doesNotMatch(roomCreation, /room_invites|generate_invite_code|invite_code/);
  assert.match(migration, /drop function if exists public\.join_room_by_invite\(text, text, text\)/i);
  assert.match(migration, /drop function if exists public\.generate_invite_code\(\)/i);
  assert.match(
    migration,
    /create or replace function public\.revoke_room_invite[\s\S]*?is_active_account\(p_actor_user_id\)[\s\S]*?role in \('owner', 'manager'\)[\s\S]*?invite_revoke_not_authorized/i,
  );
  assert.doesNotMatch(migration, /set token_hash = coalesce\(token_hash, encode\(digest\(code, 'sha256'\)/i);
  assert.match(migration, /when token_hash is null then 'revoked'/i);
  assert.match(migration, /when token_hash is null then encode\(gen_random_bytes\(32\), 'hex'\)/i);
});

test('invitation database functions record attempts and audits for every stable denial', async () => {
  const migration = await readFile(new URL('../../../supabase/migrations/20260718120000_commercial_readiness_foundation.sql', import.meta.url), 'utf8');
  const helperStart = migration.indexOf('create or replace function public.record_invitation_outcome');
  const helperEnd = migration.indexOf('$$;', helperStart);
  const helper = migration.slice(helperStart, helperEnd);
  const redeemStart = migration.indexOf('create or replace function public.redeem_room_invite');
  const redeemEnd = migration.indexOf('$$;', redeemStart);
  const redeem = migration.slice(redeemStart, redeemEnd);

  assert.ok(helperStart > 0, 'a single transactional outcome recorder must exist');
  assert.match(helper, /insert into public\.invitation_attempts/i);
  assert.match(helper, /append_audit_event/i);
  assert.match(helper, /p_actor_user_id uuid/i);
  assert.match(helper, /p_invite_id, p_actor_user_id, p_ip_key/i);
  for (const code of ['account_not_active', 'invite_invalid', 'invite_revoked', 'invite_replaced', 'invite_expired', 'invite_exhausted']) {
    assert.match(redeem, new RegExp(`record_invitation_outcome\\([\\s\\S]*?'${code}'`, 'i'));
  }
  assert.match(redeem, /record_invitation_outcome\([\s\S]*?'already_member'/i);
  assert.match(helper, /p_operation not in \('preview', 'redeem', 'create', 'revoke', 'replace'\)/i);
  for (const operation of ['create', 'revoke', 'replace']) {
    const start = migration.indexOf(`create or replace function public.${operation}_room_invite`);
    const end = migration.indexOf('$$;', start);
    const source = migration.slice(start, end);
    assert.match(source, new RegExp(`record_invitation_outcome\\([\\s\\S]*?'${operation}'`, 'i'));
    assert.match(source, /p_ip_key/i);
  }
});

test('all invitation mutation RPCs are service-only and accept a database-revalidated actor', async () => {
  const migration = await readFile(new URL('../../../supabase/migrations/20260718120000_commercial_readiness_foundation.sql', import.meta.url), 'utf8');
  for (const operation of ['create', 'redeem', 'revoke', 'replace']) {
    const functionName = `${operation}_room_invite`;
    const start = migration.indexOf(`create or replace function public.${functionName}(`);
    const end = migration.indexOf('$$;', start);
    const body = migration.slice(start, end);
    assert.match(body, /p_actor_user_id uuid/i);
    assert.match(body, /auth\.role\(\) <> 'service_role'/i);
    assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}\\([^)]+\\) to service_role;`, 'i'));
    assert.doesNotMatch(migration, new RegExp(`grant execute on function public\\.${functionName}\\([^)]+\\) to authenticated;`, 'i'));
  }
});

test('invitation mutation routes verify the user then invoke RPCs with a service client', async () => {
  const routes = await Promise.all([
    readFile(new URL('../../app/api/rooms/[roomId]/invites/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../app/api/rooms/[roomId]/invites/[inviteId]/revoke/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../app/api/rooms/[roomId]/invites/[inviteId]/replace/route.ts', import.meta.url), 'utf8'),
  ]);
  for (const source of routes) {
    assert.match(source, /getVerifiedInviteActor/);
    assert.match(source, /createSupabaseAdminClient/);
  }
  const redeemHandlers = await readFile(new URL('../../app/api/invites/[token]/invite-handlers.ts', import.meta.url), 'utf8');
  assert.match(redeemHandlers, /getVerifiedInviteActor/);
  assert.match(redeemHandlers, /createSupabaseAdminClient/);
});
