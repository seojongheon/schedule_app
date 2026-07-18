import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertPrivacyReauthentication,
  normalizeOptionalPhone,
  privacyLoginDestination,
} from './privacy-request.ts';

test('privacy operations require authentication and reauthentication within ten minutes', () => {
  assert.throws(() => assertPrivacyReauthentication(null), /authentication/i);
  assert.throws(() => assertPrivacyReauthentication({ userId: 'user-1', lastReauthenticatedAt: null }), /reauthentication/i);
  assert.throws(
    () => assertPrivacyReauthentication(
      { userId: 'user-1', lastReauthenticatedAt: '2026-07-18T11:49:59.999Z' },
      new Date('2026-07-18T12:00:00Z'),
    ),
    /reauthentication/i,
  );
  assert.equal(assertPrivacyReauthentication(
    { userId: 'user-1', lastReauthenticatedAt: '2026-07-18T11:50:00Z' },
    new Date('2026-07-18T12:00:00Z'),
  ), 'user-1');
});

test('phone correction accepts a Korean mobile number or an explicit null only', () => {
  assert.equal(normalizeOptionalPhone(null), null);
  assert.equal(normalizeOptionalPhone('010-1234-5678'), '01012345678');
  assert.throws(() => normalizeOptionalPhone('02-123-4567'), /mobile phone/i);
  assert.throws(() => normalizeOptionalPhone(undefined), /phone field/i);
});

test('deletion-pending accounts return only to the withdrawal cancellation area', () => {
  assert.equal(privacyLoginDestination('deletion_pending'), '/account/withdrawal');
  assert.equal(privacyLoginDestination('active'), '/dashboard');
  assert.equal(privacyLoginDestination('pending_profile'), '/auth/complete-profile');
  assert.equal(privacyLoginDestination('suspended'), null);
  assert.equal(privacyLoginDestination('deleted'), null);
});
