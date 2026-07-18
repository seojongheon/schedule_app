import { randomUUID } from 'node:crypto';
import {
  type InquiryCategory,
  type InquiryStatus,
} from '../../domain/support/inquiry-policy.ts';
import { type ServiceRole } from '../../domain/authorization/capabilities.ts';
import {
  decryptPrivateValue,
  encryptPrivateValue,
  type EncryptedEnvelope,
  type EncryptionKeyring,
} from '../../lib/privacy/encryption.ts';

type QueryResult<T> = { data: T; error: Error | null };

type QueryBuilder = PromiseLike<QueryResult<unknown>> & {
  select(columns: string): QueryBuilder;
  insert(values: Record<string, unknown>): QueryBuilder;
  update(values: Record<string, unknown>): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  is(column: string, value: null): QueryBuilder;
  order(column: string, options?: { ascending: boolean }): QueryBuilder;
  single(): Promise<QueryResult<unknown>>;
  maybeSingle(): Promise<QueryResult<unknown>>;
};

export type InquiryRepositoryClient = {
  from(table: string): QueryBuilder;
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult<unknown>>;
};

type InquiryRow = {
  id: string;
  user_id: string;
  category: InquiryCategory;
  subject: string;
  body_ciphertext: string;
  body_iv: string;
  body_auth_tag: string;
  key_version: number;
  status: InquiryStatus;
  assigned_to_user_id: string | null;
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
  retention_until?: string | null;
};

type MessageRow = {
  id: string;
  inquiry_id: string;
  author_user_id: string;
  author_kind: 'user' | 'admin';
  body_ciphertext: string;
  body_iv: string;
  body_auth_tag: string;
  key_version: number;
  created_at: string;
};

function unwrap<T>(result: QueryResult<unknown>): T {
  if (result.error) throw result.error;
  return result.data as T;
}

function envelope(row: { body_ciphertext: string; body_iv: string; body_auth_tag: string; key_version: number }): EncryptedEnvelope {
  return {
    algorithm: 'aes-256-gcm',
    keyVersion: `v${row.key_version}`,
    ciphertext: row.body_ciphertext,
    iv: row.body_iv,
    tag: row.body_auth_tag,
  };
}

function numericKeyVersion(version: string): number {
  const value = Number(version.slice(1));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid encryption key version.');
  return value;
}

export function createInquiryRepository(client: InquiryRepositoryClient, keyring: EncryptionKeyring) {
  return {
    async create(input: { actorUserId: string; category: InquiryCategory; subject: string; body: string; requestId: string }) {
      const inquiryId = randomUUID();
      const body = encryptPrivateValue(input.body, { recordId: inquiryId, field: 'body' }, keyring);
      const row = unwrap<{ inquiry_id: string; status: InquiryStatus }>(await client.rpc('create_support_inquiry', {
        p_inquiry_id: inquiryId,
        p_actor_user_id: input.actorUserId,
        p_category: input.category,
        p_subject: input.subject,
        p_body_ciphertext: body.ciphertext,
        p_body_iv: body.iv,
        p_body_auth_tag: body.tag,
        p_key_version: numericKeyVersion(body.keyVersion),
        p_request_id: input.requestId,
      }));
      return { inquiryId: row.inquiry_id, status: row.status };
    },

    async listForUser(actorUserId: string) {
      const result = await client.from('support_inquiries')
        .select('id, category, subject, status, assigned_to_user_id, created_at, updated_at, closed_at')
        .eq('user_id', actorUserId)
        .order('updated_at', { ascending: false });
      return unwrap<Array<Omit<InquiryRow, 'body_ciphertext' | 'body_iv' | 'body_auth_tag' | 'key_version' | 'user_id'>>>(await result);
    },

    async getDetail(input: { inquiryId: string; actorUserId: string; serviceRoles: ServiceRole[]; requestId: string }) {
      const row = unwrap<InquiryRow & { messages: MessageRow[] }>(await client.rpc('read_support_inquiry_content', {
        p_inquiry_id: input.inquiryId,
        p_actor_user_id: input.actorUserId,
        p_request_id: input.requestId,
      }));
      const messages = row.messages ?? [];
      return {
        id: row.id,
        category: row.category,
        subject: row.subject,
        status: row.status,
        assignedToUserId: row.assigned_to_user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        closedAt: row.closed_at ?? null,
        body: decryptPrivateValue(envelope(row), { recordId: row.id, field: 'body' }, keyring),
        messages: messages.map((message) => ({
          id: message.id,
          authorUserId: message.author_user_id,
          authorKind: message.author_kind,
          createdAt: message.created_at,
          body: decryptPrivateValue(envelope(message), { recordId: message.id, field: 'body' }, keyring),
        })),
      };
    },

    async claim(input: { inquiryId: string; actorUserId: string; serviceRoles: ServiceRole[]; requestId: string }) {
      const row = unwrap<{ inquiry_id: string; assigned_to_user_id: string }>(await client.rpc('claim_support_inquiry', {
        p_inquiry_id: input.inquiryId,
        p_actor_user_id: input.actorUserId,
        p_request_id: input.requestId,
      }));
      return { inquiryId: row.inquiry_id, assignedToUserId: row.assigned_to_user_id };
    },

    async reply(input: { inquiryId: string; actorUserId: string; serviceRoles: ServiceRole[]; body: string; requestId: string }) {
      const messageId = randomUUID();
      const body = encryptPrivateValue(input.body, { recordId: messageId, field: 'body' }, keyring);
      const row = unwrap<{ message_id: string }>(await client.rpc('reply_support_inquiry', {
        p_message_id: messageId,
        p_inquiry_id: input.inquiryId,
        p_actor_user_id: input.actorUserId,
        p_body_ciphertext: body.ciphertext,
        p_body_iv: body.iv,
        p_body_auth_tag: body.tag,
        p_key_version: numericKeyVersion(body.keyVersion),
        p_request_id: input.requestId,
      }));
      return { messageId: row.message_id };
    },

    async changeStatus(input: { inquiryId: string; actorUserId: string; serviceRoles: ServiceRole[]; status: InquiryStatus; requestId: string }) {
      return unwrap<{ id: string; status: InquiryStatus; closed_at: string | null; retention_until: string | null }>(
        await client.rpc('change_support_inquiry_status', {
          p_inquiry_id: input.inquiryId,
          p_actor_user_id: input.actorUserId,
          p_status: input.status,
          p_request_id: input.requestId,
        }),
      );
    },
  };
}
