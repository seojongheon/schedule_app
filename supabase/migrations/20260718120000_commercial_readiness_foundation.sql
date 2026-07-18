-- Commercial-readiness security foundation.
-- This migration is additive. Legacy compatibility columns remain until all
-- application reads have moved to the protected structures below.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists account_state text,
  add column if not exists is_under_14 boolean not null default false,
  add column if not exists terms_version text,
  add column if not exists privacy_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists session_started_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_reauthenticated_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_due_at timestamptz;

update public.profiles
set display_name = coalesce(nullif(trim(display_name), ''), nullif(trim(name), ''), '사용자'),
    account_state = coalesce(
      account_state,
      case when status = 'active' then 'active' else 'restricted' end
    );

alter table public.profiles
  alter column display_name set not null,
  alter column account_state set not null,
  alter column account_state set default 'pending_email_verification';

alter table public.profiles
  add constraint profiles_display_name_length_check
    check (char_length(trim(display_name)) between 1 and 80),
  add constraint profiles_account_state_check
    check (account_state in (
      'pending_email_verification', 'pending_profile', 'pending_guardian_consent',
      'active', 'restricted', 'suspended', 'deletion_pending', 'deleted'
    )),
  add constraint profiles_deletion_window_check
    check (
      (deletion_requested_at is null and deletion_due_at is null)
      or (deletion_requested_at is not null and deletion_due_at >= deletion_requested_at)
    );

create table public.private_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone_ciphertext text,
  phone_iv text,
  phone_auth_tag text,
  phone_lookup_hash text unique,
  birth_date_ciphertext text,
  birth_date_iv text,
  birth_date_auth_tag text,
  key_version integer not null check (key_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (phone_ciphertext is null and phone_iv is null and phone_auth_tag is null and phone_lookup_hash is null)
    or (phone_ciphertext is not null and phone_iv is not null and phone_auth_tag is not null)
  ),
  check (
    (birth_date_ciphertext is null and birth_date_iv is null and birth_date_auth_tag is null)
    or (birth_date_ciphertext is not null and birth_date_iv is not null and birth_date_auth_tag is not null)
  )
);

create table public.account_email_references (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_lookup_hash text not null unique,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'withdrawn')),
  guardian_name_ciphertext text,
  guardian_name_iv text,
  guardian_name_auth_tag text,
  guardian_phone_ciphertext text,
  guardian_phone_iv text,
  guardian_phone_auth_tag text,
  guardian_phone_lookup_hash text,
  key_version integer not null check (key_version > 0),
  provider text not null,
  evidence_reference text not null,
  terms_version text not null,
  privacy_version text not null,
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  expires_at timestamptz not null,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'approved') = (verified_at is not null)),
  check ((status = 'withdrawn') = (withdrawn_at is not null))
);

create unique index guardian_consents_one_current_idx
  on public.guardian_consents(child_user_id)
  where status in ('pending', 'approved');

create table public.service_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('super_admin', 'operations_admin', 'support_admin', 'auditor')),
  granted_by_user_id uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_by_user_id uuid references public.profiles(id),
  revoked_at timestamptz,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  check ((revoked_at is null) = (revoked_by_user_id is null))
);

create unique index service_role_assignments_active_idx
  on public.service_role_assignments(user_id, role)
  where revoked_at is null;

insert into public.service_role_assignments (user_id, role, granted_by_user_id, reason)
select id, 'super_admin', id, 'Migrated from legacy service administrator flag'
from public.profiles
where is_service_admin = true
on conflict (user_id, role) where revoked_at is null do nothing;

alter table public.room_members drop constraint if exists room_members_role_check;
alter table public.room_members
  add constraint room_members_role_check check (role in ('owner', 'manager', 'member', 'viewer'));

alter table public.scheduling_rooms
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'invite_preview')),
  add column if not exists restriction_state text not null default 'active'
    check (restriction_state in ('active', 'restricted')),
  add column if not exists restricted_until timestamptz;

alter table public.room_invites
  add column if not exists token_hash text,
  add column if not exists token_hint text,
  add column if not exists grant_role text not null default 'member'
    check (grant_role in ('member', 'viewer')),
  add column if not exists status text not null default 'active'
    check (status in ('active', 'revoked', 'expired', 'exhausted', 'replaced')),
  add column if not exists revoked_by_user_id uuid references public.profiles(id),
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text,
  add column if not exists replacement_invite_id uuid references public.room_invites(id);

update public.room_invites
set token_hash = coalesce(token_hash, encode(digest(code, 'sha256'), 'hex')),
    token_hint = coalesce(token_hint, right(code, 4)),
    expires_at = coalesce(expires_at, created_at + interval '7 days'),
    max_uses = coalesce(max_uses, 100),
    status = case
      when is_active = false then 'revoked'
      when expires_at is not null and expires_at <= now() then 'expired'
      when max_uses is not null and used_count >= max_uses then 'exhausted'
      else status
    end,
    revoked_at = case when is_active = false then coalesce(revoked_at, created_at) else revoked_at end,
    revocation_reason = case
      when is_active = false then coalesce(revocation_reason, 'Migrated inactive legacy invitation')
      else revocation_reason
    end,
    code = 'legacy-' || id::text;

alter table public.room_invites
  alter column token_hash set not null,
  alter column expires_at set not null,
  alter column max_uses set not null,
  add constraint room_invites_use_count_check check (max_uses >= 1 and used_count between 0 and max_uses),
  add constraint room_invites_revocation_check check (
    status not in ('revoked', 'replaced')
    or (revoked_at is not null and revocation_reason is not null)
  );

create unique index room_invites_token_hash_idx on public.room_invites(token_hash);

create table public.invitation_attempts (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid references public.room_invites(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  ip_key text not null,
  event_type text not null check (event_type in ('preview', 'validate', 'redeem', 'deny')),
  result_code text not null,
  request_id text not null,
  occurred_at timestamptz not null default now()
);

create index invitation_attempts_invite_time_idx on public.invitation_attempts(invite_id, occurred_at desc);

create table public.support_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  category text not null check (category in ('general', 'account', 'consent', 'privacy', 'appeal')),
  subject text not null check (char_length(trim(subject)) between 1 and 160),
  body_ciphertext text not null,
  body_iv text not null,
  body_auth_tag text not null,
  key_version integer not null check (key_version > 0),
  status text not null default 'open' check (status in ('open', 'in_progress', 'answered', 'closed')),
  assigned_to_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  retention_until timestamptz,
  check ((status = 'closed') = (closed_at is not null)),
  check (retention_until is null or retention_until >= closed_at)
);

create table public.support_inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.support_inquiries(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id),
  author_kind text not null check (author_kind in ('user', 'admin')),
  body_ciphertext text not null,
  body_iv text not null,
  body_auth_tag text not null,
  key_version integer not null check (key_version > 0),
  created_at timestamptz not null default now()
);

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  audience_role text not null check (audience_role in ('support_admin', 'operations_admin', 'super_admin')),
  type text not null check (type in ('new_inquiry', 'aging_inquiry', 'security_alert', 'job_failure')),
  target_type text not null,
  target_id uuid not null,
  read_by_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id) on delete restrict,
  target_type text not null check (target_type in ('account', 'room')),
  target_id uuid not null,
  reason_code text not null,
  detail_ciphertext text,
  detail_iv text,
  detail_auth_tag text,
  key_version integer,
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'dismissed')),
  assigned_to_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (
    (detail_ciphertext is null and detail_iv is null and detail_auth_tag is null and key_version is null)
    or (detail_ciphertext is not null and detail_iv is not null and detail_auth_tag is not null and key_version > 0)
  )
);

create table public.sanctions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('account', 'room')),
  target_id uuid not null,
  sanction_type text not null check (sanction_type in ('restrict', 'suspend')),
  reason text not null check (char_length(trim(reason)) between 1 and 1000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  imposed_by_user_id uuid not null references public.profiles(id),
  released_by_user_id uuid references public.profiles(id),
  released_at timestamptz,
  release_reason text,
  check ((released_at is null and released_by_user_id is null and release_reason is null)
    or (released_at is not null and released_by_user_id is not null and release_reason is not null))
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_type text not null check (actor_type in ('user', 'admin', 'system', 'anonymous')),
  actor_key text not null,
  target_type text not null,
  target_key text not null,
  result text not null check (result in ('success', 'denied', 'failure')),
  reason_code text not null,
  request_id text not null,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '1 year'),
  check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_occurred_at_idx on public.audit_events(occurred_at desc);
create index audit_events_target_idx on public.audit_events(target_type, target_key, occurred_at desc);

create table public.rate_limit_counters (
  scope text not null check (scope in ('general_ip', 'sensitive_ip', 'login_account')),
  subject_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_key, window_started_at)
);

create table public.rate_limit_violations (
  id uuid primary key default gen_random_uuid(),
  subject_key text not null,
  policy text not null check (policy in ('general', 'sensitive')),
  occurred_at timestamptz not null default now(),
  request_id text not null,
  retention_until timestamptz not null default (now() + interval '90 days')
);

create index rate_limit_violations_subject_time_idx
  on public.rate_limit_violations(subject_key, occurred_at desc);

create table public.ip_blocks (
  id uuid primary key default gen_random_uuid(),
  ip_key text not null,
  blocked_at timestamptz not null default now(),
  blocked_until timestamptz not null,
  source text not null check (source in ('automatic', 'manual')),
  reason text not null,
  released_by_user_id uuid references public.profiles(id),
  released_at timestamptz,
  release_reason text,
  check (blocked_until > blocked_at),
  check ((released_at is null and released_by_user_id is null and release_reason is null)
    or (released_at is not null and released_by_user_id is not null and release_reason is not null))
);

create unique index ip_blocks_one_active_idx on public.ip_blocks(ip_key) where released_at is null;

create table public.deletion_records (
  subject_key text primary key,
  requested_at timestamptz not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  replayed_at timestamptz,
  result_code text not null,
  check (due_at >= requested_at)
);

create trigger private_profiles_touch_updated_at before update on public.private_profiles
for each row execute function public.touch_updated_at();
create trigger account_email_references_touch_updated_at before update on public.account_email_references
for each row execute function public.touch_updated_at();
create trigger guardian_consents_touch_updated_at before update on public.guardian_consents
for each row execute function public.touch_updated_at();
create trigger support_inquiries_touch_updated_at before update on public.support_inquiries
for each row execute function public.touch_updated_at();

create or replace function public.prevent_audit_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Audit events are append-only.';
end;
$$;

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.prevent_audit_mutation();

create or replace function public.prevent_last_super_admin_removal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'super_admin' and old.revoked_at is null
     and (tg_op = 'DELETE' or new.revoked_at is not null) then
    if (select count(*) from public.service_role_assignments
        where role = 'super_admin' and revoked_at is null) <= 1 then
      raise exception 'At least one active super administrator must remain.';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger service_roles_preserve_last_super
before update or delete on public.service_role_assignments
for each row execute function public.prevent_last_super_admin_removal();

create or replace function public.is_active_account(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = p_user_id and account_state = 'active');
$$;

create or replace function public.has_service_capability(p_capability text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_account(auth.uid()) and exists (
    select 1 from public.service_role_assignments sra
    where sra.user_id = auth.uid() and sra.revoked_at is null and (
      sra.role = 'super_admin'
      or (sra.role = 'operations_admin' and p_capability in
        ('user_room.read', 'restriction.manage', 'report_sanction.manage', 'audit.read_operations', 'ip_block.release'))
      or (sra.role = 'support_admin' and p_capability in
        ('user_room.lookup_limited', 'inquiry.read_content', 'inquiry.reply', 'audit.read_support'))
      or (sra.role = 'auditor' and p_capability in
        ('user_room.read_masked', 'report_sanction.read', 'inquiry.read_metadata', 'audit.read_masked', 'ip_block.read'))
    )
  );
$$;

create or replace function public.is_service_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_service_capability('user_room.read');
$$;

create or replace function public.append_audit_event(
  p_event_type text, p_actor_type text, p_actor_key text,
  p_target_type text, p_target_key text, p_result text,
  p_reason_code text, p_request_id text, p_metadata jsonb default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_key text;
begin
  if p_event_type !~ '^[a-z][a-z0-9_.-]{1,99}$'
     or p_actor_type not in ('user', 'admin', 'system', 'anonymous')
     or p_result not in ('success', 'denied', 'failure')
     or coalesce(p_request_id, '') = '' then
    raise exception 'Invalid audit event.';
  end if;
  for v_key in select jsonb_object_keys(coalesce(p_metadata, '{}')) loop
    if v_key not in ('operation', 'scope', 'status', 'count', 'role', 'provider', 'category', 'enabled')
       or jsonb_typeof(p_metadata -> v_key) not in ('string', 'number', 'boolean') then
      raise exception 'Audit metadata key is not allowed.';
    end if;
  end loop;
  insert into public.audit_events (
    event_type, actor_type, actor_key, target_type, target_key,
    result, reason_code, request_id, metadata
  ) values (
    p_event_type, p_actor_type, p_actor_key, p_target_type, p_target_key,
    p_result, p_reason_code, p_request_id, coalesce(p_metadata, '{}')
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_room_invite(
  p_room_id uuid, p_token_hash text, p_token_hint text, p_grant_role text,
  p_expires_at timestamptz, p_max_uses integer, p_request_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_active_account(auth.uid())
     or not coalesce(public.current_room_role(p_room_id) in ('owner', 'manager'), false) then
    raise exception 'Invitation creation is not authorized.';
  end if;
  if p_grant_role not in ('member', 'viewer')
     or p_max_uses < 1 or p_max_uses > 1000
     or p_expires_at <= now() or p_expires_at > now() + interval '30 days'
     or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid invitation policy.';
  end if;
  insert into public.room_invites(
    room_id, code, token_hash, token_hint, grant_role, status,
    expires_at, max_uses, created_by_user_id, is_active
  ) values (
    p_room_id, 'secure-' || gen_random_uuid()::text, p_token_hash, right(p_token_hint, 8),
    p_grant_role, 'active', p_expires_at, p_max_uses, auth.uid(), true
  ) returning id into v_id;
  perform public.append_audit_event(
    'invitation.created', 'user', auth.uid()::text, 'invitation', v_id::text,
    'success', 'invite_created', p_request_id,
    jsonb_build_object('role', p_grant_role, 'operation', 'create')
  );
  return v_id;
end;
$$;

create or replace function public.record_guardian_verification(
  p_status text, p_provider text, p_evidence_reference text,
  p_terms_version text, p_privacy_version text, p_request_id text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_consent_id uuid;
begin
  if auth.uid() is null or p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid guardian verification result.';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and account_state = 'pending_guardian_consent') then
    raise exception 'Guardian verification is not available for this account.';
  end if;
  select id into v_consent_id from public.guardian_consents
  where child_user_id = auth.uid() and status in ('pending', 'approved') for update;
  if v_consent_id is null then
    insert into public.guardian_consents(
      child_user_id, status, key_version, provider, evidence_reference,
      terms_version, privacy_version, verified_at, expires_at
    ) values (
      auth.uid(), p_status, 1, p_provider, p_evidence_reference,
      p_terms_version, p_privacy_version,
      case when p_status = 'approved' then now() else null end,
      now() + interval '24 hours'
    ) returning id into v_consent_id;
  else
    update public.guardian_consents set status = p_status,
      evidence_reference = p_evidence_reference,
      verified_at = case when p_status = 'approved' then now() else null end,
      updated_at = now()
    where id = v_consent_id;
  end if;
  if p_status = 'approved' then
    perform set_config('app.profile_transition', 'allowed', true);
    update public.profiles set account_state = 'active' where id = auth.uid();
  end if;
  perform public.append_audit_event(
    'guardian.verification', 'user', auth.uid()::text, 'guardian_consent', v_consent_id::text,
    'success', 'guardian_' || p_status, p_request_id,
    jsonb_build_object('status', p_status, 'provider', p_provider)
  );
  return case when p_status = 'approved' then 'active' else 'pending_guardian_consent' end;
end;
$$;

create or replace function public.complete_commercial_profile(
  p_display_name text, p_is_under_14 boolean,
  p_terms_version text, p_privacy_version text,
  p_email_lookup_hash text,
  p_phone_ciphertext text, p_phone_iv text, p_phone_auth_tag text, p_phone_lookup_hash text,
  p_birth_date_ciphertext text, p_birth_date_iv text, p_birth_date_auth_tag text,
  p_key_version integer, p_request_id text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_state text := case when p_is_under_14 then 'pending_guardian_consent' else 'active' end;
begin
  if auth.uid() is null or char_length(trim(p_display_name)) not between 1 and 80
     or p_key_version < 1 or p_birth_date_ciphertext is null then
    raise exception 'Invalid profile completion request.';
  end if;
  insert into public.account_email_references(user_id, email_lookup_hash, verified_at)
  values (auth.uid(), p_email_lookup_hash, now())
  on conflict (user_id) do update set email_lookup_hash = excluded.email_lookup_hash,
    verified_at = excluded.verified_at, updated_at = now();
  insert into public.private_profiles(
    user_id, phone_ciphertext, phone_iv, phone_auth_tag, phone_lookup_hash,
    birth_date_ciphertext, birth_date_iv, birth_date_auth_tag, key_version
  ) values (
    auth.uid(), p_phone_ciphertext, p_phone_iv, p_phone_auth_tag, p_phone_lookup_hash,
    p_birth_date_ciphertext, p_birth_date_iv, p_birth_date_auth_tag, p_key_version
  ) on conflict (user_id) do update set
    phone_ciphertext = excluded.phone_ciphertext, phone_iv = excluded.phone_iv,
    phone_auth_tag = excluded.phone_auth_tag, phone_lookup_hash = excluded.phone_lookup_hash,
    birth_date_ciphertext = excluded.birth_date_ciphertext, birth_date_iv = excluded.birth_date_iv,
    birth_date_auth_tag = excluded.birth_date_auth_tag, key_version = excluded.key_version,
    updated_at = now();
  perform set_config('app.profile_transition', 'allowed', true);
  update public.profiles set
    display_name = trim(p_display_name), name = trim(p_display_name),
    email = auth.uid()::text || '@redacted.invalid', phone = null,
    is_under_14 = p_is_under_14, terms_version = p_terms_version,
    privacy_version = p_privacy_version, terms_accepted_at = now(), privacy_accepted_at = now(),
    account_state = v_state
  where id = auth.uid() and account_state in ('pending_email_verification', 'pending_profile', 'pending_guardian_consent');
  if not found then raise exception 'Profile cannot be completed in its current state.'; end if;
  perform public.append_audit_event(
    'profile.completed', 'user', auth.uid()::text, 'account', auth.uid()::text,
    'success', 'profile_completed', p_request_id,
    jsonb_build_object('status', v_state, 'operation', 'complete')
  );
  return v_state;
end;
$$;

create or replace function public.revoke_room_invite(
  p_invite_id uuid, p_reason text, p_request_id text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite public.room_invites%rowtype;
begin
  select * into v_invite from public.room_invites where id = p_invite_id for update;
  if not found or not coalesce(public.current_room_role(v_invite.room_id) in ('owner', 'manager'), false) then
    raise exception 'Invitation revocation is not authorized.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 1 then
    raise exception 'A revocation reason is required.';
  end if;
  if v_invite.status = 'active' then
    update public.room_invites
    set status = 'revoked', is_active = false, revoked_by_user_id = auth.uid(),
        revoked_at = now(), revocation_reason = left(trim(p_reason), 500)
    where id = p_invite_id;
  end if;
  perform public.append_audit_event(
    'invitation.revoked', 'user', auth.uid()::text, 'invitation', p_invite_id::text,
    'success', 'invite_revoked', p_request_id, jsonb_build_object('operation', 'revoke')
  );
end;
$$;

create or replace function public.replace_room_invite(
  p_invite_id uuid, p_token_hash text, p_token_hint text,
  p_expires_at timestamptz, p_max_uses integer, p_reason text, p_request_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_old public.room_invites%rowtype;
  v_new_id uuid;
begin
  select * into v_old from public.room_invites where id = p_invite_id for update;
  if not found or v_old.status <> 'active'
     or not coalesce(public.current_room_role(v_old.room_id) in ('owner', 'manager'), false) then
    raise exception 'Invitation replacement is not authorized.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 1 then
    raise exception 'A replacement reason is required.';
  end if;
  v_new_id := public.create_room_invite(
    v_old.room_id, p_token_hash, p_token_hint, v_old.grant_role,
    p_expires_at, p_max_uses, p_request_id
  );
  update public.room_invites
  set status = 'replaced', is_active = false, revoked_by_user_id = auth.uid(),
      revoked_at = now(), revocation_reason = left(trim(p_reason), 500),
      replacement_invite_id = v_new_id
  where id = p_invite_id;
  perform public.append_audit_event(
    'invitation.replaced', 'user', auth.uid()::text, 'invitation', p_invite_id::text,
    'success', 'invite_replaced', p_request_id, jsonb_build_object('operation', 'replace')
  );
  return v_new_id;
end;
$$;

create or replace function public.redeem_room_invite(
  p_token_hash text, p_nickname text, p_color text, p_ip_key text, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_invite public.room_invites%rowtype;
  v_existing public.room_members%rowtype;
  v_member_id uuid;
begin
  if auth.uid() is null or not public.is_active_account(auth.uid()) then
    insert into public.invitation_attempts(actor_user_id, ip_key, event_type, result_code, request_id)
    values (auth.uid(), p_ip_key, 'deny', 'account_not_active', p_request_id);
    return jsonb_build_object('result', 'account_not_active');
  end if;

  select * into v_invite from public.room_invites
  where token_hash = p_token_hash for update;

  if not found then
    insert into public.invitation_attempts(actor_user_id, ip_key, event_type, result_code, request_id)
    values (auth.uid(), p_ip_key, 'deny', 'invite_invalid', p_request_id);
    return jsonb_build_object('result', 'invite_invalid');
  end if;

  if v_invite.status <> 'active' then
    return jsonb_build_object('result', 'invite_' || v_invite.status);
  elsif v_invite.expires_at <= now() then
    update public.room_invites set status = 'expired' where id = v_invite.id;
    return jsonb_build_object('result', 'invite_expired');
  elsif v_invite.used_count >= v_invite.max_uses then
    update public.room_invites set status = 'exhausted' where id = v_invite.id;
    return jsonb_build_object('result', 'invite_exhausted');
  end if;

  select * into v_existing from public.room_members
  where room_id = v_invite.room_id and user_id = auth.uid();
  if found then
    return jsonb_build_object(
      'result', 'already_member', 'room_id', v_invite.room_id,
      'member_id', v_existing.id, 'role', v_existing.role
    );
  end if;

  insert into public.room_members(room_id, user_id, nickname, role, color)
  values (v_invite.room_id, auth.uid(), p_nickname, v_invite.grant_role, p_color)
  returning id into v_member_id;

  update public.room_invites
  set used_count = used_count + 1,
      status = case when used_count + 1 >= max_uses then 'exhausted' else status end
  where id = v_invite.id;

  insert into public.invitation_attempts(invite_id, actor_user_id, ip_key, event_type, result_code, request_id)
  values (v_invite.id, auth.uid(), p_ip_key, 'redeem', 'invite_redeemed', p_request_id);

  perform public.append_audit_event(
    'invitation.redeemed', 'user', auth.uid()::text, 'invitation', v_invite.id::text,
    'success', 'invite_redeemed', p_request_id,
    jsonb_build_object('role', v_invite.grant_role, 'operation', 'redeem')
  );
  return jsonb_build_object(
    'result', 'invite_redeemed', 'room_id', v_invite.room_id,
    'member_id', v_member_id, 'role', v_invite.grant_role
  );
end;
$$;

create or replace function public.apply_admin_sanction(
  p_target_type text, p_target_id uuid, p_sanction_type text,
  p_reason text, p_ends_at timestamptz, p_request_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.has_service_capability('restriction.manage') then
    raise exception 'Sanction management is not authorized.';
  end if;
  if p_target_type not in ('account', 'room')
     or p_sanction_type not in ('restrict', 'suspend')
     or char_length(trim(coalesce(p_reason, ''))) < 1
     or (p_ends_at is not null and p_ends_at <= now()) then
    raise exception 'Invalid sanction policy.';
  end if;

  insert into public.sanctions(
    target_type, target_id, sanction_type, reason, ends_at, imposed_by_user_id
  ) values (
    p_target_type, p_target_id, p_sanction_type, left(trim(p_reason), 1000),
    p_ends_at, auth.uid()
  ) returning id into v_id;

  if p_target_type = 'account' then
    perform set_config('app.profile_transition', 'allowed', true);
    update public.profiles
    set account_state = case when p_sanction_type = 'suspend' then 'suspended' else 'restricted' end
    where id = p_target_id and account_state <> 'deleted';
  else
    update public.scheduling_rooms
    set restriction_state = 'restricted', restricted_until = p_ends_at
    where id = p_target_id;
  end if;
  if not found then raise exception 'Sanction target was not found.'; end if;

  perform public.append_audit_event(
    'sanction.applied', 'admin', auth.uid()::text, p_target_type, p_target_id::text,
    'success', 'sanction_applied', p_request_id,
    jsonb_build_object('operation', 'apply', 'status', p_sanction_type)
  );
  return v_id;
end;
$$;

create or replace function public.release_admin_sanction(
  p_sanction_id uuid, p_reason text, p_request_id text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_sanction public.sanctions%rowtype;
begin
  if not public.has_service_capability('restriction.manage') then
    raise exception 'Sanction management is not authorized.';
  end if;
  select * into v_sanction from public.sanctions where id = p_sanction_id for update;
  if not found or v_sanction.released_at is not null then
    raise exception 'Active sanction was not found.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 1 then
    raise exception 'A release reason is required.';
  end if;
  update public.sanctions
  set released_by_user_id = auth.uid(), released_at = now(), release_reason = left(trim(p_reason), 1000)
  where id = p_sanction_id;

  if v_sanction.target_type = 'account' then
    if not exists (
      select 1 from public.sanctions where target_type = 'account'
        and target_id = v_sanction.target_id and id <> p_sanction_id
        and released_at is null and (ends_at is null or ends_at > now())
    ) then
      perform set_config('app.profile_transition', 'allowed', true);
      update public.profiles set account_state = 'active'
      where id = v_sanction.target_id and account_state in ('restricted', 'suspended');
    end if;
  else
    if not exists (
      select 1 from public.sanctions where target_type = 'room'
        and target_id = v_sanction.target_id and id <> p_sanction_id
        and released_at is null and (ends_at is null or ends_at > now())
    ) then
      update public.scheduling_rooms
      set restriction_state = 'active', restricted_until = null
      where id = v_sanction.target_id;
    end if;
  end if;

  perform public.append_audit_event(
    'sanction.released', 'admin', auth.uid()::text, v_sanction.target_type, v_sanction.target_id::text,
    'success', 'sanction_released', p_request_id, jsonb_build_object('operation', 'release')
  );
end;
$$;

create or replace function public.evaluate_request_limit(
  p_scope text, p_subject_key text, p_policy text, p_request_id text,
  p_now timestamptz default now()
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_window_seconds integer;
  v_soft_limit integer;
  v_hard_limit integer;
  v_window_start timestamptz;
  v_count integer;
  v_violations integer;
  v_block public.ip_blocks%rowtype;
begin
  if p_scope = 'general_ip' and p_policy = 'general' then
    v_window_seconds := 60; v_soft_limit := 90; v_hard_limit := 120;
  elsif p_scope in ('sensitive_ip', 'login_account') and p_policy = 'sensitive' then
    v_window_seconds := 300; v_soft_limit := 20; v_hard_limit := 20;
  else
    raise exception 'Invalid request-control policy.';
  end if;

  select * into v_block from public.ip_blocks
  where ip_key = p_subject_key and released_at is null and blocked_until > p_now
  order by blocked_until desc limit 1;
  if found then
    return jsonb_build_object('action', 'block', 'retry_after', ceil(extract(epoch from v_block.blocked_until - p_now)));
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from p_now) / v_window_seconds) * v_window_seconds);
  insert into public.rate_limit_counters(scope, subject_key, window_started_at, request_count, updated_at)
  values (p_scope, p_subject_key, v_window_start, 1, p_now)
  on conflict (scope, subject_key, window_started_at) do update
    set request_count = public.rate_limit_counters.request_count + 1, updated_at = excluded.updated_at
  returning request_count into v_count;

  if v_count > v_hard_limit then
    insert into public.rate_limit_violations(subject_key, policy, occurred_at, request_id)
    values (p_subject_key, p_policy, p_now, p_request_id);
    select count(*) into v_violations from public.rate_limit_violations
    where subject_key = p_subject_key and occurred_at > p_now - interval '10 minutes';
    if v_violations >= 3 and p_scope <> 'login_account' then
      insert into public.ip_blocks(ip_key, blocked_at, blocked_until, source, reason)
      values (p_subject_key, p_now, p_now + interval '15 minutes', 'automatic', 'repeated_rate_limit_excess')
      on conflict (ip_key) where released_at is null do update
        set blocked_until = greatest(public.ip_blocks.blocked_until, excluded.blocked_until);
      return jsonb_build_object('action', 'block', 'retry_after', 900);
    end if;
    return jsonb_build_object(
      'action', 'reject',
      'retry_after', greatest(1, v_window_seconds - floor(extract(epoch from p_now - v_window_start)))
    );
  elsif v_count > v_soft_limit then
    return jsonb_build_object('action', 'delay', 'delay_ms', 1000 + floor(random() * 2001));
  end if;
  return jsonb_build_object('action', 'allow');
end;
$$;

create or replace function public.prevent_commercial_profile_protected_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() = old.id
     and current_setting('app.profile_transition', true) is distinct from 'allowed'
     and (
    new.account_state is distinct from old.account_state
    or new.is_under_14 is distinct from old.is_under_14
    or new.terms_version is distinct from old.terms_version
    or new.privacy_version is distinct from old.privacy_version
    or new.deletion_requested_at is distinct from old.deletion_requested_at
    or new.deletion_due_at is distinct from old.deletion_due_at
  ) then
    raise exception 'Protected profile fields require a dedicated server operation.';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_commercial_protected_change
before update on public.profiles
for each row execute function public.prevent_commercial_profile_protected_change();

alter table public.private_profiles enable row level security;
alter table public.account_email_references enable row level security;
alter table public.guardian_consents enable row level security;
alter table public.service_role_assignments enable row level security;
alter table public.invitation_attempts enable row level security;
alter table public.support_inquiries enable row level security;
alter table public.support_inquiry_messages enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.reports enable row level security;
alter table public.sanctions enable row level security;
alter table public.audit_events enable row level security;
alter table public.rate_limit_counters enable row level security;
alter table public.rate_limit_violations enable row level security;
alter table public.ip_blocks enable row level security;
alter table public.deletion_records enable row level security;

create policy service_roles_select_self on public.service_role_assignments for select
using (user_id = auth.uid());
create policy invitation_attempts_admin_read on public.invitation_attempts for select
using (public.has_service_capability('audit.read_operations'));
create policy support_inquiries_admin_metadata on public.support_inquiries for select
using (public.has_service_capability('inquiry.read_metadata'));
create policy admin_notifications_role_read on public.admin_notifications for select
using (public.has_service_capability('inquiry.read_content') or public.has_service_capability('restriction.manage'));
create policy reports_reporter_read on public.reports for select
using (reporter_user_id = auth.uid());
create policy reports_admin_read on public.reports for select
using (public.has_service_capability('report_sanction.read') or public.has_service_capability('report_sanction.manage'));
create policy sanctions_admin_read on public.sanctions for select
using (public.has_service_capability('report_sanction.read') or public.has_service_capability('report_sanction.manage'));
create policy audit_events_admin_read on public.audit_events for select
using (
  public.has_service_capability('audit.read_full')
  or public.has_service_capability('audit.read_operations')
  or public.has_service_capability('audit.read_support')
  or public.has_service_capability('audit.read_masked')
);
create policy ip_blocks_admin_read on public.ip_blocks for select
using (public.has_service_capability('ip_block.read') or public.has_service_capability('ip_block.release'));

drop policy if exists "invites_select_room_members" on public.room_invites;
drop policy if exists "invites_owner_manage" on public.room_invites;
drop policy if exists "preliminary_tasks_self" on public.preliminary_tasks;
create policy preliminary_tasks_non_viewer_self on public.preliminary_tasks for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    room_id is null
    or public.current_room_role(room_id) in ('owner', 'manager', 'member')
  )
);

create policy schedules_member_insert on public.schedules for insert
with check (
  public.is_active_account(auth.uid())
  and public.current_room_role(room_id) in ('owner', 'manager', 'member')
  and exists (
    select 1 from public.room_members creator
    where creator.id = created_by_member_id
      and creator.room_id = room_id
      and creator.user_id = auth.uid()
  )
);

create policy schedules_member_update_own on public.schedules for update
using (
  public.is_active_account(auth.uid())
  and public.current_room_role(room_id) = 'member'
  and exists (
    select 1 from public.room_members creator
    where creator.id = created_by_member_id and creator.user_id = auth.uid()
  )
)
with check (
  public.current_room_role(room_id) = 'member'
  and exists (
    select 1 from public.room_members creator
    where creator.id = created_by_member_id
      and creator.room_id = room_id
      and creator.user_id = auth.uid()
  )
);

revoke all on public.private_profiles, public.account_email_references,
  public.guardian_consents, public.room_invites, public.support_inquiry_messages, public.rate_limit_counters,
  public.rate_limit_violations, public.deletion_records from anon, authenticated;
revoke insert, update, delete on public.audit_events from anon, authenticated;
revoke all on function public.append_audit_event(text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.evaluate_request_limit(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.redeem_room_invite(text, text, text, text, text) from public, anon;
revoke all on function public.create_room_invite(uuid, text, text, text, timestamptz, integer, text) from public, anon;
revoke all on function public.revoke_room_invite(uuid, text, text) from public, anon;
revoke all on function public.replace_room_invite(uuid, text, text, timestamptz, integer, text, text) from public, anon;
revoke all on function public.apply_admin_sanction(text, uuid, text, text, timestamptz, text) from public, anon;
revoke all on function public.release_admin_sanction(uuid, text, text) from public, anon;
revoke all on function public.complete_commercial_profile(text, boolean, text, text, text, text, text, text, text, text, text, text, integer, text) from public, anon;
revoke all on function public.record_guardian_verification(text, text, text, text, text, text) from public, anon;
grant execute on function public.append_audit_event(text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.evaluate_request_limit(text, text, text, text, timestamptz) to service_role;
grant execute on function public.redeem_room_invite(text, text, text, text, text) to authenticated;
grant execute on function public.create_room_invite(uuid, text, text, text, timestamptz, integer, text) to authenticated;
grant execute on function public.revoke_room_invite(uuid, text, text) to authenticated;
grant execute on function public.replace_room_invite(uuid, text, text, timestamptz, integer, text, text) to authenticated;
grant execute on function public.apply_admin_sanction(text, uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.release_admin_sanction(uuid, text, text) to authenticated;
grant execute on function public.complete_commercial_profile(text, boolean, text, text, text, text, text, text, text, text, text, text, integer, text) to authenticated;
grant execute on function public.record_guardian_verification(text, text, text, text, text, text) to authenticated;
grant execute on function public.has_service_capability(text) to authenticated;
grant execute on function public.is_active_account(uuid) to authenticated;
