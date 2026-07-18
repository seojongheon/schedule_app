import { createWithdrawalPlan, type WithdrawalPlan } from '../../domain/privacy/privacy-lifecycle.ts';
import {
  decryptPrivateValue,
  encryptPrivateValue,
  type EncryptedEnvelope,
  type EncryptionKeyring,
} from '../../lib/privacy/encryption.ts';

type PrivateProfileRecord = {
  userId: string;
  phone: EncryptedEnvelope | null;
  birthDate: EncryptedEnvelope;
};

type PrivacyStore = {
  read(userId: string): Promise<PrivateProfileRecord | null>;
  write(userId: string, values: Partial<Pick<PrivateProfileRecord, 'phone' | 'birthDate'>>): Promise<void>;
  beginWithdrawal(plan: WithdrawalPlan): Promise<void>;
};

type PrivacyAudit = (event: {
  eventType: string;
  targetUserId: string;
  requestId: string;
  fields?: string[];
}) => Promise<void>;

function assertOwner(actorUserId: string, targetUserId: string) {
  if (actorUserId !== targetUserId) throw new Error('Privacy operation is not authorized.');
}

export function createPrivacyRepository(dependencies: {
  keyring: EncryptionKeyring;
  store: PrivacyStore;
  audit: PrivacyAudit;
}) {
  async function requireRecord(userId: string) {
    const record = await dependencies.store.read(userId);
    if (!record) throw new Error('Private profile was not found.');
    return record;
  }

  return {
    async exportProfile(actorUserId: string, targetUserId: string, requestId: string) {
      assertOwner(actorUserId, targetUserId);
      const record = await requireRecord(targetUserId);
      const result = {
        phone: record.phone
          ? decryptPrivateValue(record.phone, { recordId: targetUserId, field: 'phone' }, dependencies.keyring)
          : null,
        birthDate: decryptPrivateValue(record.birthDate, { recordId: targetUserId, field: 'birth_date' }, dependencies.keyring),
      };
      await dependencies.audit({
        eventType: 'privacy.profile_accessed', targetUserId, requestId,
        fields: ['phone', 'birth_date'],
      });
      return result;
    },

    async correctPhone(actorUserId: string, targetUserId: string, phone: string | null, requestId: string) {
      assertOwner(actorUserId, targetUserId);
      const encrypted = phone
        ? encryptPrivateValue(phone, { recordId: targetUserId, field: 'phone' }, dependencies.keyring)
        : null;
      await dependencies.store.write(targetUserId, { phone: encrypted });
      await dependencies.audit({ eventType: 'privacy.profile_corrected', targetUserId, requestId, fields: ['phone'] });
    },

    async rotateProfileKeys(userId: string, requestId: string): Promise<boolean> {
      const record = await requireRecord(userId);
      const active = dependencies.keyring.currentVersion;
      if (record.birthDate.keyVersion === active && (!record.phone || record.phone.keyVersion === active)) return false;
      const values = {
        birthDate: encryptPrivateValue(
          decryptPrivateValue(record.birthDate, { recordId: userId, field: 'birth_date' }, dependencies.keyring),
          { recordId: userId, field: 'birth_date' }, dependencies.keyring,
        ),
        phone: record.phone ? encryptPrivateValue(
          decryptPrivateValue(record.phone, { recordId: userId, field: 'phone' }, dependencies.keyring),
          { recordId: userId, field: 'phone' }, dependencies.keyring,
        ) : null,
      };
      await dependencies.store.write(userId, values);
      await dependencies.audit({ eventType: 'privacy.profile_reencrypted', targetUserId: userId, requestId, fields: ['phone', 'birth_date'] });
      return true;
    },

    async withdraw(actorUserId: string, targetUserId: string, requestId: string, now = new Date()) {
      assertOwner(actorUserId, targetUserId);
      const plan = createWithdrawalPlan(targetUserId, now);
      await dependencies.store.beginWithdrawal(plan);
      await dependencies.audit({ eventType: 'privacy.withdrawal_requested', targetUserId, requestId });
      return plan;
    },
  };
}
