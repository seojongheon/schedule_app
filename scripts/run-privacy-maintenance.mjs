import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const MODES = new Set(['deletion', 'retention', 'reencrypt', 'reconcile']);

export function parseMaintenanceMode(argv) {
  const mode = argv[0];
  if (!MODES.has(mode)) throw new Error('A valid privacy maintenance mode is required.');
  return mode;
}

async function processRows(rows, operation) {
  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await operation(row);
      processed += 1;
    } catch {
      failed += 1;
    }
  }
  return { processed, failed };
}

export async function runDeletionMaintenance(dependencies, now = new Date()) {
  return processRows(await dependencies.listDue(now), dependencies.finalize);
}

export async function runRetentionMaintenance(dependencies, now = new Date()) {
  await dependencies.cleanup(now);
  return { processed: 1, failed: 0 };
}

export async function runReencryptionMaintenance(dependencies, activeVersion) {
  return processRows(await dependencies.listStale(activeVersion), dependencies.rotate);
}

export async function runRestoreReconciliation(dependencies) {
  const completed = new Set(await dependencies.listCompletedSubjects());
  const restored = await dependencies.listRestoredSubjects();
  return processRows(restored.filter((subject) => completed.has(subject)), dependencies.quarantine);
}

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function keyringFromEnvironment() {
  const activeVersion = Number(requireEnvironment('PRIVATE_DATA_ACTIVE_KEY_VERSION'));
  if (!Number.isInteger(activeVersion) || activeVersion < 1) throw new Error('Invalid private-data key version.');
  const keys = new Map();
  for (const [name, value] of Object.entries(process.env)) {
    const match = /^PRIVATE_DATA_KEY_V(\d+)$/.exec(name);
    if (!match || !value) continue;
    const decoded = Buffer.from(value, 'base64');
    if (decoded.byteLength !== 32) throw new Error(`${name} must be a 256-bit base64 key.`);
    keys.set(Number(match[1]), decoded);
  }
  if (!keys.has(activeVersion)) throw new Error('The active private-data key is unavailable.');
  return { activeVersion, keys };
}

function aad(userId, field) {
  return Buffer.from(`private-profile\u0000${userId}\u0000${field}`, 'utf8');
}

function decryptColumn(row, field, keyring) {
  const ciphertext = row[`${field}_ciphertext`];
  if (ciphertext === null) return null;
  const key = keyring.keys.get(row.key_version);
  if (!key) throw new Error('Historical private-data key is unavailable.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(row[`${field}_iv`], 'base64'));
  decipher.setAAD(aad(row.user_id, field === 'birth_date' ? 'birth_date' : 'phone'));
  decipher.setAuthTag(Buffer.from(row[`${field}_auth_tag`], 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

function encryptColumn(value, userId, field, key) {
  if (value === null) return { ciphertext: null, iv: null, authTag: null };
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(userId, field));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}

async function createLiveContext() {
  const secret = requireEnvironment('PRIVACY_MAINTENANCE_SECRET');
  if (secret.length < 32) throw new Error('PRIVACY_MAINTENANCE_SECRET must be at least 32 characters.');
  const url = requireEnvironment('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? requireEnvironment('SUPABASE_SECRET_KEY');
  const { createClient } = await import('@supabase/supabase-js');
  return {
    client: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    requestId: randomUUID(),
  };
}

async function runLive(mode) {
  const { client, requestId } = await createLiveContext();
  if (mode === 'deletion') {
    return runDeletionMaintenance({
      async listDue(now) {
        const { data, error } = await client.from('profiles')
          .select('id, deletion_subject_key').eq('account_state', 'deletion_pending')
          .lte('deletion_due_at', now.toISOString()).not('deletion_subject_key', 'is', null);
        if (error) throw error;
        return (data ?? []).map((row) => ({ userId: row.id, subjectKey: row.deletion_subject_key }));
      },
      async finalize(row) {
        const deletedEmail = `${row.subjectKey.slice(0, 48)}@deleted.invalid`;
        const { error: authError } = await client.auth.admin.updateUserById(row.userId, {
          email: deletedEmail, phone: null, user_metadata: {}, app_metadata: { deletion_state: 'completed' },
        });
        if (authError) throw authError;
        const { error } = await client.rpc('finalize_due_account_deletion', {
          p_user_id: row.userId, p_subject_key: row.subjectKey, p_request_id: requestId,
        });
        if (error) throw error;
      },
    });
  }
  if (mode === 'retention') {
    return runRetentionMaintenance({
      async cleanup() {
        const { error } = await client.rpc('cleanup_expired_security_data', { p_request_id: requestId });
        if (error) throw error;
      },
    });
  }
  if (mode === 'reencrypt') {
    const keyring = keyringFromEnvironment();
    return runReencryptionMaintenance({
      async listStale(activeVersion) {
        const { data, error } = await client.from('private_profiles').select('*').neq('key_version', activeVersion);
        if (error) throw error;
        return data ?? [];
      },
      async rotate(row) {
        const phone = encryptColumn(decryptColumn(row, 'phone', keyring), row.user_id, 'phone', keyring.keys.get(keyring.activeVersion));
        const birth = encryptColumn(decryptColumn(row, 'birth_date', keyring), row.user_id, 'birth_date', keyring.keys.get(keyring.activeVersion));
        const { error } = await client.from('private_profiles').update({
          phone_ciphertext: phone.ciphertext, phone_iv: phone.iv, phone_auth_tag: phone.authTag,
          birth_date_ciphertext: birth.ciphertext, birth_date_iv: birth.iv, birth_date_auth_tag: birth.authTag,
          key_version: keyring.activeVersion,
        }).eq('user_id', row.user_id).eq('key_version', row.key_version);
        if (error) throw error;
        const { error: auditError } = await client.rpc('append_audit_event', {
          p_event_type: 'privacy.profile_reencrypted', p_actor_type: 'system', p_actor_key: 'privacy-maintenance',
          p_target_type: 'account', p_target_key: row.user_id, p_result: 'success',
          p_reason_code: 'key_rotated', p_request_id: requestId, p_metadata: { operation: 'reencrypt' },
        });
        if (auditError) throw auditError;
      },
    }, keyring.activeVersion);
  }
  return runRestoreReconciliation({
    async listCompletedSubjects() {
      const { data, error } = await client.from('deletion_records').select('subject_key').not('completed_at', 'is', null);
      if (error) throw error;
      return (data ?? []).map((row) => row.subject_key);
    },
    async listRestoredSubjects() {
      const { data, error } = await client.from('profiles').select('deletion_subject_key').neq('account_state', 'deleted').not('deletion_subject_key', 'is', null);
      if (error) throw error;
      return (data ?? []).map((row) => row.deletion_subject_key);
    },
    async quarantine(subjectKey) {
      const { error } = await client.rpc('quarantine_restored_deleted_subject', { p_subject_key: subjectKey, p_request_id: requestId });
      if (error) throw error;
    },
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  try {
    const mode = parseMaintenanceMode(process.argv.slice(2));
    const result = await runLive(mode);
    process.stdout.write(`${JSON.stringify({ mode, ...result })}\n`);
    if (result.failed > 0) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`Privacy maintenance failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}
