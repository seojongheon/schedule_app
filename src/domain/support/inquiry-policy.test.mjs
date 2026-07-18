import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allowedInquiryCategories,
  canReplyToInquiry,
  canReadInquiryContent,
  resolveInquiryTransition,
} from './inquiry-policy.ts';

test('limited account states may open only recovery-related inquiry categories', () => {
  assert.deepEqual(allowedInquiryCategories('active'), ['general', 'account', 'consent', 'privacy', 'appeal']);
  assert.deepEqual(allowedInquiryCategories('pending_guardian_consent'), ['account', 'consent', 'privacy', 'appeal']);
  assert.deepEqual(allowedInquiryCategories('restricted'), ['account', 'consent', 'privacy', 'appeal']);
  assert.deepEqual(allowedInquiryCategories('suspended'), ['account', 'consent', 'privacy', 'appeal']);
  assert.deepEqual(allowedInquiryCategories('deletion_pending'), []);
  assert.equal(allowedInquiryCategories('restricted').includes('general'), false);
});

test('inquiry transitions are scoped to the requester or assigned support actor', () => {
  assert.deepEqual(resolveInquiryTransition({ actor: 'user', from: 'answered', to: 'closed' }), { allowed: true, closes: true });
  assert.deepEqual(resolveInquiryTransition({ actor: 'support', from: 'open', to: 'in_progress' }), { allowed: true, closes: false });
  assert.deepEqual(resolveInquiryTransition({ actor: 'support', from: 'in_progress', to: 'answered' }), { allowed: true, closes: false });
  assert.deepEqual(resolveInquiryTransition({ actor: 'user', from: 'open', to: 'closed' }), { allowed: false, reason: 'inquiry_transition_denied' });
  assert.deepEqual(resolveInquiryTransition({ actor: 'support', from: 'answered', to: 'closed' }), { allowed: false, reason: 'inquiry_transition_denied' });
});

test('content access requires ownership or the assigned support actor', () => {
  assert.equal(canReadInquiryContent({ actorUserId: 'user-1', ownerUserId: 'user-1', assignedToUserId: null, canReadContent: false }), true);
  assert.equal(canReadInquiryContent({ actorUserId: 'staff-1', ownerUserId: 'user-1', assignedToUserId: 'staff-1', canReadContent: true }), true);
  assert.equal(canReadInquiryContent({ actorUserId: 'staff-2', ownerUserId: 'user-1', assignedToUserId: 'staff-1', canReadContent: true }), false);
  assert.equal(canReadInquiryContent({ actorUserId: 'staff-1', ownerUserId: 'user-1', assignedToUserId: null, canReadContent: true }), false);
});

test('closed inquiries reject every new reply', () => {
  assert.equal(canReplyToInquiry('open'), true);
  assert.equal(canReplyToInquiry('in_progress'), true);
  assert.equal(canReplyToInquiry('answered'), true);
  assert.equal(canReplyToInquiry('closed'), false);
});
