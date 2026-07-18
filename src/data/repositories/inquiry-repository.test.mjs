import assert from 'node:assert/strict';
import test from 'node:test';

import { createInquiryRepository } from './inquiry-repository.ts';
import { encryptPrivateValue } from '../../lib/privacy/encryption.ts';

function fakeClient(responses = {}) {
  const calls = [];
  const chain = (table) => ({
    select(columns) { calls.push({ kind: 'select', table, columns }); return this; },
    insert(values) { calls.push({ kind: 'insert', table, values }); return this; },
    update(values) { calls.push({ kind: 'update', table, values }); return this; },
    eq(column, value) { calls.push({ kind: 'eq', table, column, value }); return this; },
    is(column, value) { calls.push({ kind: 'is', table, column, value }); return this; },
    order(column, options) { calls.push({ kind: 'order', table, column, options }); return this; },
    maybeSingle() { return Promise.resolve(responses[table] ?? { data: null, error: null }); },
    single() { return Promise.resolve(responses[table] ?? { data: null, error: null }); },
    then(resolve, reject) { return Promise.resolve(responses[table] ?? { data: [], error: null }).then(resolve, reject); },
  });
  return { calls, from: (table) => chain(table), rpc: async (name, args) => {
    calls.push({ kind: 'rpc', name, args });
    return responses[name] ?? { data: 'audit-1', error: null };
  } };
}

const keyring = { currentVersion: 'v1', keys: { v1: Buffer.alloc(32, 9).toString('base64') } };

test('creation delegates inquiry, body-free notifications, and audit to one transaction RPC', async () => {
  const client = fakeClient({
    create_support_inquiry: { data: { inquiry_id: '11111111-1111-4111-8111-111111111111', status: 'open' }, error: null },
  });
  const repository = createInquiryRepository(client, keyring);

  const result = await repository.create({ actorUserId: 'user-1', category: 'privacy', subject: '정보 요청', body: '비공개 내용', requestId: 'request-1' });

  assert.deepEqual(result, { inquiryId: '11111111-1111-4111-8111-111111111111', status: 'open' });
  const transaction = client.calls.find((call) => call.kind === 'rpc' && call.name === 'create_support_inquiry');
  assert.ok(transaction);
  assert.equal(transaction.args.p_body_ciphertext.includes('비공개 내용'), false);
  assert.equal(transaction.args.p_key_version, 1);
  assert.equal(client.calls.some((call) => call.kind === 'insert'), false);
});

test('every authorized personal-content view uses the audited read transaction', async () => {
  const body = encryptPrivateValue('비공개 본문', { recordId: 'inquiry-1', field: 'body' }, keyring);
  const encrypted = { body_ciphertext: body.ciphertext, body_iv: body.iv, body_auth_tag: body.tag, key_version: 1 };
  const client = fakeClient({
    read_support_inquiry_content: { data: { id: 'inquiry-1', user_id: 'user-1', category: 'privacy', assigned_to_user_id: 'staff-1', status: 'in_progress', subject: '제목', messages: [], ...encrypted }, error: null },
  });
  const repository = createInquiryRepository(client, keyring);

  await repository.getDetail({ inquiryId: 'inquiry-1', actorUserId: 'staff-1', serviceRoles: ['support_admin'], requestId: 'request-2' });
  await repository.getDetail({ inquiryId: 'inquiry-1', actorUserId: 'staff-1', serviceRoles: ['support_admin'], requestId: 'request-3' });
  const reads = client.calls.filter((call) => call.kind === 'rpc' && call.name === 'read_support_inquiry_content');
  assert.equal(reads.length, 2);
  assert.deepEqual(reads.map((call) => call.args.p_request_id), ['request-2', 'request-3']);
  assert.equal(client.calls.some((call) => call.kind === 'select' && call.table === 'support_inquiries'), false);
});

test('claim, reply, and status mutations each delegate all side effects to a transaction RPC', async () => {
  const client = fakeClient({
    claim_support_inquiry: { data: { inquiry_id: 'inquiry-1', assigned_to_user_id: 'staff-1' }, error: null },
    reply_support_inquiry: { data: { message_id: 'message-1' }, error: null },
    change_support_inquiry_status: { data: { id: 'inquiry-1', status: 'answered', closed_at: null, retention_until: null }, error: null },
  });
  const repository = createInquiryRepository(client, keyring);

  await repository.claim({ inquiryId: 'inquiry-1', actorUserId: 'staff-1', serviceRoles: ['support_admin'], requestId: 'request-1' });
  await repository.reply({ inquiryId: 'inquiry-1', actorUserId: 'staff-1', serviceRoles: ['support_admin'], body: '답변', requestId: 'request-2' });
  await repository.changeStatus({ inquiryId: 'inquiry-1', actorUserId: 'staff-1', serviceRoles: ['support_admin'], status: 'answered', requestId: 'request-3' });

  assert.deepEqual(client.calls.filter((call) => call.kind === 'rpc').map((call) => call.name), [
    'claim_support_inquiry', 'reply_support_inquiry', 'change_support_inquiry_status',
  ]);
  assert.equal(client.calls.some((call) => ['insert', 'update'].includes(call.kind)), false);
});

test('closed inquiry reply failures from the transaction are propagated', async () => {
  const client = fakeClient({
    reply_support_inquiry: { data: null, error: new Error('Closed inquiries cannot be replied to.') },
  });
  const repository = createInquiryRepository(client, keyring);

  await assert.rejects(
    () => repository.reply({ inquiryId: 'inquiry-1', actorUserId: 'user-1', serviceRoles: [], body: '추가', requestId: 'request-1' }),
    /closed inquiries cannot be replied to/i,
  );
});
