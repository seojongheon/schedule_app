import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateMiddlewareAccess } from './middleware-access.ts';

const active = {
  accountState: 'active',
  sessionStartedAt: '2026-07-01T00:00:00.000Z',
  lastSeenAt: '2026-07-17T12:00:00.000Z',
  now: new Date('2026-07-18T12:00:00.000Z'),
};

test('public authentication and invitation preview paths do not require a session', () => {
  for (const pathname of ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/recovery', '/api/invites/token']) {
    assert.deepEqual(evaluateMiddlewareAccess({ pathname, authenticated: false, profile: null, now: active.now }), { action: 'allow' });
  }
  assert.deepEqual(evaluateMiddlewareAccess({ pathname: '/api/auth/password', method: 'POST', authenticated: false, profile: null, now: active.now }), { action: 'authentication_required' });
});

test('product pages require an active account and a current session', () => {
  assert.deepEqual(evaluateMiddlewareAccess({ pathname: '/dashboard', authenticated: true, profile: active, now: active.now }), { action: 'allow' });
  assert.deepEqual(evaluateMiddlewareAccess({ pathname: '/dashboard', authenticated: true, profile: { ...active, accountState: 'deletion_pending' }, now: active.now }), { action: 'redirect', location: '/account/withdrawal' });
  assert.deepEqual(evaluateMiddlewareAccess({ pathname: '/rooms', authenticated: true, profile: { ...active, lastSeenAt: '2026-07-10T00:00:00.000Z' }, now: active.now }), { action: 'expire_session' });
});

test('authenticated API calls fail when the application session is expired', () => {
  assert.deepEqual(evaluateMiddlewareAccess({ pathname: '/api/inquiries', authenticated: true, profile: { ...active, sessionStartedAt: '2026-06-01T00:00:00.000Z' }, now: active.now }), { action: 'expire_session' });
});
