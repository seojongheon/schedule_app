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
  add column if not exists deletion_due_at timestamptz,
  add column if not exists deletion_subject_key text;

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
set token_hash = case when token_hash is null then encode(gen_random_bytes(32), 'hex') else token_hash end,
    token_hint = case when token_hash is null then null else token_hint end,
    expires_at = coalesce(expires_at, created_at + interval '7 days'),
    max_uses = coalesce(max_uses, 100),
    status = case
      when token_hash is null then 'revoked'
      when is_active = false then 'revoked'
      when expires_at is not null and expires_at <= now() then 'expired'
      when max_uses is not null and used_count >= max_uses then 'exhausted'
      else status
    end,
    is_active = case when token_hash is null then false else is_active end,
    revoked_at = case
      when token_hash is null then coalesce(revoked_at, now())
      when is_active = false then coalesce(revoked_at, created_at)
      else revoked_at
    end,
    revocation_reason = case
      when token_hash is null then coalesce(revocation_reason, 'Legacy invitation invalidated during secure-token migration')
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
  type text not null check (type in ('new_inquiry', 'inquiry_reply', 'aging_inquiry', 'security_alert', 'job_failure')),
  target_type text not null,
  target_id uuid not null,
  read_by_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index admin_notifications_aging_once_idx
  on public.admin_notifications(audience_role, type, target_type, target_id)
  where type = 'aging_inquiry';

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('inquiry_reply', 'inquiry_status')),
  target_type text not null check (target_type = 'inquiry'),
  target_id uuid not null references public.support_inquiries(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index user_notifications_user_time_idx
  on public.user_notifications(user_id, created_at desc);

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

create table public.request_control_policies (
  policy text primary key check (policy in ('general', 'sensitive')),
  window_seconds integer not null check (window_seconds between 1 and 3600),
  soft_limit integer not null check (soft_limit >= 1),
  hard_limit integer not null check (hard_limit >= soft_limit),
  repeated_excess_limit integer not null check (repeated_excess_limit between 1 and 20),
  repeated_excess_window_seconds integer not null check (repeated_excess_window_seconds between 60 and 86400),
  block_seconds integer not null check (block_seconds between 60 and 86400),
  delay_min_ms integer not null check (delay_min_ms between 0 and 30000),
  delay_max_ms integer not null check (delay_max_ms >= delay_min_ms and delay_max_ms <= 30000),
  updated_by_user_id uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.request_control_policy_revisions (
  id uuid primary key default gen_random_uuid(),
  policy text not null check (policy in ('general', 'sensitive')),
  previous_values jsonb not null,
  new_values jsonb not null,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  changed_by_user_id uuid not null references public.profiles(id),
  request_id text not null,
  changed_at timestamptz not null default now()
);

create index request_control_policy_revisions_policy_time_idx
  on public.request_control_policy_revisions(policy, changed_at desc);

insert into public.request_control_policies(
  policy, window_seconds, soft_limit, hard_limit, repeated_excess_limit,
  repeated_excess_window_seconds, block_seconds, delay_min_ms, delay_max_ms
) values
  ('general', 60, 90, 120, 3, 600, 900, 1000, 3000),
  ('sensitive', 300, 20, 20, 3, 600, 900, 0, 0);

create table public.request_control_events (
  id uuid primary key default gen_random_uuid(),
  subject_key text not null,
  scope text not null check (scope in ('general_ip', 'sensitive_ip', 'login_account')),
  policy text not null check (policy in ('general', 'sensitive')),
  action text not null check (action in ('delay', 'reject', 'block', 'automatic_release', 'manual_release')),
  request_count integer not null default 0 check (request_count >= 0),
  applied_limit integer not null check (applied_limit >= 1),
  delay_ms integer,
  retry_after_seconds integer,
  request_id text not null,
  occurred_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '90 days'),
  check (delay_ms is null or delay_ms between 0 and 30000),
  check (retry_after_seconds is null or retry_after_seconds >= 0)
);

create index request_control_events_subject_time_idx
  on public.request_control_events(subject_key, occurred_at desc);

create table public.ip_blocks (
  id uuid primary key default gen_random_uuid(),
  ip_key text not null,
  blocked_at timestamptz not null default now(),
  blocked_until timestamptz not null,
  source text not null check (source in ('automatic', 'manual')),
  reason text not null,
  released_by_user_id uuid references public.profiles(id),
  released_at timestamptz,
  release_source text check (release_source in ('automatic', 'manual')),
  release_reason text,
  check (blocked_until > blocked_at),
  check ((released_at is null and released_by_user_id is null and release_source is null and release_reason is null)
    or (released_at is not null and release_source = 'automatic' and released_by_user_id is null and release_reason is not null)
    or (released_at is not null and release_source = 'manual' and released_by_user_id is not null and release_reason is not null))
);

create unique index ip_blocks_one_active_idx on public.ip_blocks(ip_key) where released_at is null;

create table public.deletion_records (
  subject_key text primary key,
  requested_at timestamptz not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  replayed_at timestamptz,
  prior_account_state text check (prior_account_state in ('active', 'restricted', 'suspended')),
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
  if current_setting('app.audit_maintenance', true) = 'allowed' and auth.role() = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'Audit events are append-only.';
end;
$$;

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.prevent_audit_mutation();

create or replace function public.prevent_last_super_admin_removal()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
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
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists(select 1 from public.profiles where id = p_user_id and account_state = 'active');
$$;

create or replace function public.has_service_capability(p_capability text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.is_active_account(auth.uid()) and exists (
    select 1 from public.service_role_assignments sra
    where sra.user_id = auth.uid() and sra.revoked_at is null and (
      sra.role = 'super_admin'
      or (sra.role = 'operations_admin' and p_capability in
        ('user_room.read', 'restriction.manage', 'report_sanction.manage', 'inquiry.read_metadata', 'audit.read_operations', 'ip_block.release'))
      or (sra.role = 'support_admin' and p_capability in
        ('user_room.lookup_limited', 'inquiry.read_content', 'inquiry.reply', 'audit.read_support'))
      or (sra.role = 'auditor' and p_capability in
        ('user_room.read_masked', 'report_sanction.read', 'inquiry.read_metadata', 'audit.read_masked', 'ip_block.read'))
    )
  );
$$;

create or replace function public.is_service_admin()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.has_service_capability('user_room.read');
$$;

create or replace function public.append_audit_event(
  p_event_type text, p_actor_type text, p_actor_key text,
  p_target_type text, p_target_key text, p_result text,
  p_reason_code text, p_request_id text, p_metadata jsonb default '{}'
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
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
    if v_key not in ('operation', 'scope', 'status', 'count', 'role', 'provider', 'category', 'enabled', 'reason')
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

create or replace function public.service_actor_has_capability(p_actor_user_id uuid, p_capability text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.is_active_account(p_actor_user_id) and exists (
    select 1 from public.service_role_assignments sra
    where sra.user_id = p_actor_user_id and sra.revoked_at is null and (
      sra.role = 'super_admin'
      or (sra.role = 'operations_admin' and p_capability in
        ('inquiry.read_metadata'))
      or (sra.role = 'support_admin' and p_capability in
        ('inquiry.read_content', 'inquiry.reply', 'audit.read_support'))
      or (sra.role = 'auditor' and p_capability in
        ('inquiry.read_metadata', 'audit.read_masked'))
    )
  );
$$;

create or replace function public.list_support_inquiry_metadata(
  p_actor_user_id uuid, p_offset integer, p_limit integer, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_rows jsonb;
  v_total integer;
  v_effective_role text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization is required.';
  end if;
  if not public.service_actor_has_capability(p_actor_user_id, 'inquiry.read_metadata')
     and not public.service_actor_has_capability(p_actor_user_id, 'inquiry.read_content') then
    raise exception 'Inquiry metadata access denied.';
  end if;
  if p_offset < 0 or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid inquiry metadata page.';
  end if;

  select sra.role into v_effective_role
  from public.service_role_assignments sra
  where sra.user_id = p_actor_user_id
    and sra.revoked_at is null
    and sra.role in ('super_admin', 'operations_admin', 'support_admin', 'auditor')
  order by case sra.role
    when 'super_admin' then 1
    when 'operations_admin' then 2
    when 'support_admin' then 3
    else 4
  end
  limit 1
  for share;
  if v_effective_role is null or not public.is_active_account(p_actor_user_id) then
    raise exception 'Inquiry metadata access denied.';
  end if;

  select count(*) into v_total from public.support_inquiries;
  if v_effective_role = 'auditor' then
    select coalesce(jsonb_agg(to_jsonb(page_row)), '[]'::jsonb) into v_rows
    from (
      select id, category, status, created_at, updated_at
      from public.support_inquiries
      order by updated_at desc
      offset p_offset limit p_limit
    ) page_row;
  else
    select coalesce(jsonb_agg(to_jsonb(page_row)), '[]'::jsonb) into v_rows
    from (
      select id, category, status, assigned_to_user_id, created_at, updated_at, closed_at
      from public.support_inquiries
      order by updated_at desc
      offset p_offset limit p_limit
    ) page_row;
  end if;
  perform public.append_audit_event(
    'inquiry.metadata_listed', 'admin', p_actor_user_id::text,
    'inquiry', 'inquiry-queue', 'success', 'inquiry_metadata_listed', p_request_id,
    jsonb_build_object('operation', 'read', 'scope', 'inquiry_metadata', 'count', jsonb_array_length(v_rows))
  );
  return jsonb_build_object('rows', v_rows, 'total', v_total, 'effectiveRole', v_effective_role);
end;
$$;

create or replace function public.create_support_inquiry(
  p_inquiry_id uuid, p_actor_user_id uuid, p_category text, p_subject text,
  p_body_ciphertext text, p_body_iv text, p_body_auth_tag text,
  p_key_version integer, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_account_state text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service authorization is required.'; end if;
  select account_state into v_account_state from public.profiles where id = p_actor_user_id;
  if v_account_state is null or v_account_state in ('deletion_pending', 'deleted') then
    raise exception 'Inquiry creation is not authorized.';
  end if;
  if p_category not in ('general', 'account', 'consent', 'privacy', 'appeal')
     or (v_account_state <> 'active' and p_category = 'general') then
    raise exception 'Inquiry category is not authorized.';
  end if;

  insert into public.support_inquiries (
    id, user_id, category, subject, body_ciphertext, body_iv, body_auth_tag, key_version, status
  ) values (
    p_inquiry_id, p_actor_user_id, p_category, p_subject,
    p_body_ciphertext, p_body_iv, p_body_auth_tag, p_key_version, 'open'
  );
  insert into public.admin_notifications(audience_role, type, target_type, target_id)
  values
    ('support_admin', 'new_inquiry', 'inquiry', p_inquiry_id),
    ('super_admin', 'new_inquiry', 'inquiry', p_inquiry_id);
  perform public.append_audit_event(
    'inquiry.created', 'user', p_actor_user_id::text, 'inquiry', p_inquiry_id::text,
    'success', 'inquiry_created', p_request_id,
    jsonb_build_object('operation', 'create', 'category', p_category)
  );
  return jsonb_build_object('inquiry_id', p_inquiry_id, 'status', 'open');
end;
$$;

create or replace function public.read_support_inquiry_content(
  p_inquiry_id uuid, p_actor_user_id uuid, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_inquiry public.support_inquiries%rowtype;
  v_actor_type text;
  v_result jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Service authorization is required.'; end if;
  select * into v_inquiry from public.support_inquiries where id = p_inquiry_id;
  if not found then raise exception 'Inquiry not found.'; end if;

  if v_inquiry.user_id = p_actor_user_id then
    v_actor_type := 'user';
  elsif v_inquiry.assigned_to_user_id = p_actor_user_id
        and public.service_actor_has_capability(p_actor_user_id, 'inquiry.read_content') then
    v_actor_type := 'admin';
  else
    raise exception 'Inquiry access denied.';
  end if;

  perform public.append_audit_event(
    'inquiry.content_read', v_actor_type, p_actor_user_id::text,
    'inquiry', p_inquiry_id::text, 'success', 'authorized_content_view', p_request_id,
    jsonb_build_object('operation', 'read', 'scope', 'inquiry')
  );

  select jsonb_build_object(
    'id', i.id, 'user_id', i.user_id, 'category', i.category, 'subject', i.subject,
    'body_ciphertext', i.body_ciphertext, 'body_iv', i.body_iv,
    'body_auth_tag', i.body_auth_tag, 'key_version', i.key_version,
    'status', i.status, 'assigned_to_user_id', i.assigned_to_user_id,
    'created_at', i.created_at, 'updated_at', i.updated_at,
    'closed_at', i.closed_at, 'retention_until', i.retention_until,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'inquiry_id', m.inquiry_id, 'author_user_id', m.author_user_id,
        'author_kind', m.author_kind, 'body_ciphertext', m.body_ciphertext,
        'body_iv', m.body_iv, 'body_auth_tag', m.body_auth_tag,
        'key_version', m.key_version, 'created_at', m.created_at
      ) order by m.created_at)
      from public.support_inquiry_messages m where m.inquiry_id = i.id
    ), '[]'::jsonb)
  ) into v_result
  from public.support_inquiries i where i.id = p_inquiry_id;
  return v_result;
end;
$$;

create or replace function public.claim_support_inquiry(
  p_inquiry_id uuid, p_actor_user_id uuid, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_inquiry public.support_inquiries%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service authorization is required.'; end if;
  if not public.service_actor_has_capability(p_actor_user_id, 'inquiry.read_content') then
    raise exception 'Inquiry claim denied.';
  end if;
  select * into v_inquiry from public.support_inquiries where id = p_inquiry_id for update;
  if not found or v_inquiry.status = 'closed'
     or (v_inquiry.assigned_to_user_id is not null and v_inquiry.assigned_to_user_id <> p_actor_user_id) then
    raise exception 'Inquiry claim denied.';
  end if;
  if v_inquiry.assigned_to_user_id is null then
    update public.support_inquiries set
      assigned_to_user_id = p_actor_user_id,
      status = case when status = 'open' then 'in_progress' else status end
    where id = p_inquiry_id;
  end if;
  perform public.append_audit_event(
    'inquiry.claimed', 'admin', p_actor_user_id::text, 'inquiry', p_inquiry_id::text,
    'success', 'inquiry_claimed', p_request_id,
    jsonb_build_object('operation', 'claim', 'status', v_inquiry.status)
  );
  return jsonb_build_object('inquiry_id', p_inquiry_id, 'assigned_to_user_id', p_actor_user_id);
end;
$$;

create or replace function public.reply_support_inquiry(
  p_message_id uuid, p_inquiry_id uuid, p_actor_user_id uuid,
  p_body_ciphertext text, p_body_iv text, p_body_auth_tag text,
  p_key_version integer, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_inquiry public.support_inquiries%rowtype;
  v_author_kind text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service authorization is required.'; end if;
  select * into v_inquiry from public.support_inquiries where id = p_inquiry_id for update;
  if not found then raise exception 'Inquiry not found.'; end if;
  if v_inquiry.status = 'closed' then
    raise exception 'Closed inquiries cannot be replied to.';
  end if;
  if v_inquiry.user_id = p_actor_user_id then
    v_author_kind := 'user';
  elsif v_inquiry.assigned_to_user_id = p_actor_user_id
        and public.service_actor_has_capability(p_actor_user_id, 'inquiry.reply') then
    v_author_kind := 'admin';
  else
    raise exception 'Inquiry access denied.';
  end if;

  insert into public.support_inquiry_messages (
    id, inquiry_id, author_user_id, author_kind,
    body_ciphertext, body_iv, body_auth_tag, key_version
  ) values (
    p_message_id, p_inquiry_id, p_actor_user_id, v_author_kind,
    p_body_ciphertext, p_body_iv, p_body_auth_tag, p_key_version
  );

  if v_author_kind = 'admin' then
    update public.support_inquiries set status = 'answered' where id = p_inquiry_id;
    insert into public.user_notifications(user_id, type, target_type, target_id)
    values (v_inquiry.user_id, 'inquiry_reply', 'inquiry', p_inquiry_id);
  else
    update public.support_inquiries set
      status = case when status = 'answered' then 'in_progress' else status end
    where id = p_inquiry_id;
    insert into public.admin_notifications(audience_role, type, target_type, target_id)
    values
      ('support_admin', 'inquiry_reply', 'inquiry', p_inquiry_id),
      ('super_admin', 'inquiry_reply', 'inquiry', p_inquiry_id);
  end if;

  perform public.append_audit_event(
    'inquiry.replied', v_author_kind, p_actor_user_id::text,
    'inquiry', p_inquiry_id::text, 'success', 'inquiry_replied', p_request_id,
    jsonb_build_object('operation', 'reply', 'role', case when v_author_kind = 'admin' then 'support' else 'user' end)
  );
  return jsonb_build_object('message_id', p_message_id);
end;
$$;

create or replace function public.change_support_inquiry_status(
  p_inquiry_id uuid, p_actor_user_id uuid, p_status text, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_inquiry public.support_inquiries%rowtype;
  v_actor_type text;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then raise exception 'Service authorization is required.'; end if;
  select * into v_inquiry from public.support_inquiries where id = p_inquiry_id for update;
  if not found then raise exception 'Inquiry not found.'; end if;

  if v_inquiry.user_id = p_actor_user_id
     and v_inquiry.status = 'answered' and p_status = 'closed' then
    v_actor_type := 'user';
  elsif v_inquiry.assigned_to_user_id = p_actor_user_id
        and public.service_actor_has_capability(p_actor_user_id, 'inquiry.reply')
        and ((v_inquiry.status = 'open' and p_status = 'in_progress')
          or (v_inquiry.status = 'in_progress' and p_status = 'answered')) then
    v_actor_type := 'admin';
  else
    raise exception 'Inquiry transition denied.';
  end if;

  update public.support_inquiries set
    status = p_status,
    closed_at = case when p_status = 'closed' then v_now else null end,
    retention_until = case when p_status = 'closed' then v_now + interval '3 years' else null end
  where id = p_inquiry_id;

  if p_status = 'answered' then
    insert into public.user_notifications(user_id, type, target_type, target_id)
    values (v_inquiry.user_id, 'inquiry_status', 'inquiry', p_inquiry_id);
  end if;
  perform public.append_audit_event(
    'inquiry.status_changed', v_actor_type, p_actor_user_id::text,
    'inquiry', p_inquiry_id::text, 'success', 'inquiry_status_changed', p_request_id,
    jsonb_build_object('operation', 'status_change', 'status', p_status)
  );
  return jsonb_build_object(
    'id', p_inquiry_id, 'status', p_status,
    'closed_at', case when p_status = 'closed' then v_now else null end,
    'retention_until', case when p_status = 'closed' then v_now + interval '3 years' else null end
  );
end;
$$;

create or replace function public.enqueue_aging_inquiry_notifications(
  p_cutoff timestamptz, p_request_id text
) returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service authorization is required.'; end if;
  insert into public.admin_notifications(audience_role, type, target_type, target_id)
  select audience.role, 'aging_inquiry', 'inquiry', inquiry.id
  from public.support_inquiries inquiry
  cross join (values ('support_admin'::text), ('super_admin'::text)) as audience(role)
  where inquiry.status in ('open', 'in_progress') and inquiry.updated_at <= p_cutoff
  on conflict do nothing;
  get diagnostics v_count = row_count;
  perform public.append_audit_event(
    'inquiry.aging_notifications_enqueued', 'system', 'inquiry-maintenance',
    'inquiry', 'aging-queue', 'success', 'aging_inquiries_enqueued', p_request_id,
    jsonb_build_object('operation', 'notify', 'count', v_count)
  );
  return v_count;
end;
$$;

create or replace function public.record_invitation_outcome(
  p_invite_id uuid, p_actor_user_id uuid, p_ip_key text, p_operation text,
  p_result_code text, p_request_id text, p_succeeded boolean
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_actor_type text;
  v_actor_key text;
begin
  if auth.role() <> 'service_role'
     or p_operation not in ('preview', 'redeem', 'create', 'revoke', 'replace')
     or coalesce(p_ip_key, '') = ''
     or coalesce(p_result_code, '') = ''
     or coalesce(p_request_id, '') = ''
     or (p_actor_user_id is not null and not exists (
       select 1 from public.profiles where id = p_actor_user_id
     )) then
    raise exception 'Invalid invitation outcome.';
  end if;

  v_actor_type := case when p_actor_user_id is null then 'anonymous' else 'user' end;
  v_actor_key := coalesce(p_actor_user_id::text, 'anonymous');

  insert into public.invitation_attempts(
    invite_id, actor_user_id, ip_key, event_type, result_code, request_id
  ) values (
    p_invite_id, p_actor_user_id, p_ip_key,
    case when p_succeeded then p_operation else 'deny' end,
    p_result_code, p_request_id
  );

  perform public.append_audit_event(
    'invitation.' || p_operation, v_actor_type, v_actor_key,
    'invitation', coalesce(p_invite_id::text, 'unknown'),
    case when p_succeeded then 'success' else 'denied' end,
    p_result_code, p_request_id,
    jsonb_build_object('operation', p_operation, 'status', p_result_code)
  );
end;
$$;

create or replace function public.create_scheduling_room(
  p_name text,
  p_description text,
  p_nickname text,
  p_color text,
  p_shared_schedule_color text,
  p_default_view text,
  p_business_start_time time,
  p_business_end_time time
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_room_id uuid;
  v_member_id uuid;
begin
  if not public.is_active_account(auth.uid()) then
    raise exception 'An active account is required.';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 120
     or char_length(trim(coalesce(p_nickname, ''))) not between 1 and 80 then
    raise exception 'Invalid room creation request.';
  end if;

  insert into public.scheduling_rooms(
    name, description, color, shared_schedule_color, owner_user_id,
    default_view, business_start_time, business_end_time
  ) values (
    trim(p_name), nullif(trim(p_description), ''), p_color, p_shared_schedule_color,
    auth.uid(), p_default_view, p_business_start_time, p_business_end_time
  ) returning id into v_room_id;

  insert into public.room_members(room_id, user_id, nickname, role, color)
  values (v_room_id, auth.uid(), trim(p_nickname), 'owner', p_color)
  returning id into v_member_id;

  insert into public.user_preferences(user_id)
  values (auth.uid()) on conflict (user_id) do nothing;

  return jsonb_build_object('room_id', v_room_id, 'member_id', v_member_id);
end;
$$;

revoke all on function public.create_scheduling_room(text, text, text, text, text, text, time, time)
  from public, anon;
grant execute on function public.create_scheduling_room(text, text, text, text, text, text, time, time)
  to authenticated;
drop function if exists public.join_room_by_invite(text, text, text);
drop function if exists public.generate_invite_code();

create or replace function public.create_room_invite(
  p_actor_user_id uuid, p_room_id uuid, p_token_hash text, p_token_hint text, p_grant_role text,
  p_expires_at timestamptz, p_max_uses integer, p_ip_key text, p_request_id text
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization is required.';
  end if;
  if not public.is_active_account(p_actor_user_id)
     or not exists (
       select 1 from public.room_members
       where room_id = p_room_id and user_id = p_actor_user_id and role in ('owner', 'manager')
     ) then
    perform public.record_invitation_outcome(
      null, p_actor_user_id, p_ip_key, 'create', 'invite_create_not_authorized', p_request_id, false
    );
    return null;
  end if;
  if p_grant_role not in ('member', 'viewer')
     or p_max_uses < 1 or p_max_uses > 1000
     or p_expires_at <= now() or p_expires_at > now() + interval '30 days'
     or p_token_hash !~ '^[a-f0-9]{64}$' then
    perform public.record_invitation_outcome(
      null, p_actor_user_id, p_ip_key, 'create', 'invite_policy_invalid', p_request_id, false
    );
    return null;
  end if;
  insert into public.room_invites(
    room_id, code, token_hash, token_hint, grant_role, status,
    expires_at, max_uses, created_by_user_id, is_active
  ) values (
    p_room_id, 'secure-' || gen_random_uuid()::text, p_token_hash, right(p_token_hint, 8),
    p_grant_role, 'active', p_expires_at, p_max_uses, p_actor_user_id, true
  ) returning id into v_id;
  perform public.append_audit_event(
    'invitation.created', 'user', p_actor_user_id::text, 'invitation', v_id::text,
    'success', 'invite_created', p_request_id,
    jsonb_build_object('role', p_grant_role, 'operation', 'create')
  );
  return v_id;
end;
$$;

create or replace function public.record_guardian_verification(
  p_status text, p_provider text, p_evidence_reference text,
  p_terms_version text, p_privacy_version text, p_request_id text
) returns text language plpgsql security definer set search_path = public, extensions as $$
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
) returns text language plpgsql security definer set search_path = public, extensions as $$
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
  p_actor_user_id uuid, p_room_id uuid, p_invite_id uuid, p_reason text, p_ip_key text, p_request_id text
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  v_invite public.room_invites%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization is required.';
  end if;
  select * into v_invite from public.room_invites
  where id = p_invite_id and room_id = p_room_id for update;
  if not found
     or not public.is_active_account(p_actor_user_id)
     or not exists (
       select 1 from public.room_members
       where room_id = v_invite.room_id and user_id = p_actor_user_id and role in ('owner', 'manager')
     ) then
    perform public.record_invitation_outcome(
      v_invite.id, p_actor_user_id, p_ip_key, 'revoke', 'invite_revoke_not_authorized', p_request_id, false
    );
    return false;
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 1 then
    perform public.record_invitation_outcome(
      v_invite.id, p_actor_user_id, p_ip_key, 'revoke', 'invite_revoke_reason_invalid', p_request_id, false
    );
    return false;
  end if;
  if v_invite.status = 'active' then
    update public.room_invites
    set status = 'revoked', is_active = false, revoked_by_user_id = p_actor_user_id,
        revoked_at = now(), revocation_reason = left(trim(p_reason), 500)
    where id = p_invite_id;
  end if;
  perform public.append_audit_event(
    'invitation.revoked', 'user', p_actor_user_id::text, 'invitation', p_invite_id::text,
    'success', 'invite_revoked', p_request_id, jsonb_build_object('operation', 'revoke')
  );
  return true;
end;
$$;

create or replace function public.replace_room_invite(
  p_actor_user_id uuid, p_room_id uuid, p_invite_id uuid, p_token_hash text, p_token_hint text,
  p_expires_at timestamptz, p_max_uses integer, p_reason text, p_ip_key text, p_request_id text
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_old public.room_invites%rowtype;
  v_new_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization is required.';
  end if;
  select * into v_old from public.room_invites
  where id = p_invite_id and room_id = p_room_id for update;
  if not found or v_old.status <> 'active' or not public.is_active_account(p_actor_user_id)
     or not exists (
       select 1 from public.room_members
       where room_id = v_old.room_id and user_id = p_actor_user_id and role in ('owner', 'manager')
     ) then
    perform public.record_invitation_outcome(
      v_old.id, p_actor_user_id, p_ip_key, 'replace', 'invite_replace_not_authorized', p_request_id, false
    );
    return null;
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 1 then
    perform public.record_invitation_outcome(
      v_old.id, p_actor_user_id, p_ip_key, 'replace', 'invite_replace_reason_invalid', p_request_id, false
    );
    return null;
  end if;
  if p_max_uses < 1 or p_max_uses > 1000
     or p_expires_at <= now() or p_expires_at > now() + interval '30 days'
     or p_token_hash !~ '^[a-f0-9]{64}$' then
    perform public.record_invitation_outcome(
      v_old.id, p_actor_user_id, p_ip_key, 'replace', 'invite_replace_policy_invalid', p_request_id, false
    );
    return null;
  end if;
  v_new_id := public.create_room_invite(
    p_actor_user_id, v_old.room_id, p_token_hash, p_token_hint, v_old.grant_role,
    p_expires_at, p_max_uses, p_ip_key, p_request_id
  );
  if v_new_id is null then
    return null;
  end if;
  update public.room_invites
  set status = 'replaced', is_active = false, revoked_by_user_id = p_actor_user_id,
      revoked_at = now(), revocation_reason = left(trim(p_reason), 500),
      replacement_invite_id = v_new_id
  where id = p_invite_id;
  perform public.append_audit_event(
    'invitation.replaced', 'user', p_actor_user_id::text, 'invitation', p_invite_id::text,
    'success', 'invite_replaced', p_request_id, jsonb_build_object('operation', 'replace')
  );
  return v_new_id;
end;
$$;

create or replace function public.redeem_room_invite(
  p_actor_user_id uuid, p_token_hash text, p_nickname text, p_color text, p_ip_key text, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_invite public.room_invites%rowtype;
  v_existing public.room_members%rowtype;
  v_member_id uuid;
  v_result text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization is required.';
  end if;
  if not public.is_active_account(p_actor_user_id) then
    perform public.record_invitation_outcome(
      null, p_actor_user_id, p_ip_key, 'redeem', 'account_not_active', p_request_id, false
    );
    return jsonb_build_object('result', 'account_not_active');
  end if;

  if char_length(trim(coalesce(p_nickname, ''))) not between 1 and 80
     or p_color !~ '^#[0-9A-Fa-f]{6}$' then
    perform public.record_invitation_outcome(
      null, p_actor_user_id, p_ip_key, 'redeem', 'invite_invalid', p_request_id, false
    );
    return jsonb_build_object('result', 'invite_invalid');
  end if;

  select * into v_invite from public.room_invites
  where token_hash = p_token_hash for update;

  if not found then
    perform public.record_invitation_outcome(
      null, p_actor_user_id, p_ip_key, 'redeem', 'invite_invalid', p_request_id, false
    );
    return jsonb_build_object('result', 'invite_invalid');
  end if;

  if v_invite.status <> 'active' then
    v_result := case v_invite.status
      when 'revoked' then 'invite_revoked'
      when 'replaced' then 'invite_replaced'
      when 'expired' then 'invite_expired'
      when 'exhausted' then 'invite_exhausted'
      else 'invite_invalid'
    end;
    perform public.record_invitation_outcome(
      v_invite.id, p_actor_user_id, p_ip_key, 'redeem', v_result, p_request_id, false
    );
    return jsonb_build_object('result', v_result);
  elsif v_invite.expires_at <= now() then
    update public.room_invites set status = 'expired' where id = v_invite.id;
    perform public.record_invitation_outcome(
      v_invite.id, p_actor_user_id, p_ip_key, 'redeem', 'invite_expired', p_request_id, false
    );
    return jsonb_build_object('result', 'invite_expired');
  elsif v_invite.used_count >= v_invite.max_uses then
    update public.room_invites set status = 'exhausted' where id = v_invite.id;
    perform public.record_invitation_outcome(
      v_invite.id, p_actor_user_id, p_ip_key, 'redeem', 'invite_exhausted', p_request_id, false
    );
    return jsonb_build_object('result', 'invite_exhausted');
  end if;

  if not exists (
    select 1 from public.scheduling_rooms
    where id = v_invite.room_id and status = 'active' and restriction_state = 'active'
  ) then
    perform public.record_invitation_outcome(
      v_invite.id, p_actor_user_id, p_ip_key, 'redeem', 'invite_invalid', p_request_id, false
    );
    return jsonb_build_object('result', 'invite_invalid');
  end if;

  select * into v_existing from public.room_members
  where room_id = v_invite.room_id and user_id = p_actor_user_id;
  if found then
    perform public.record_invitation_outcome(
      v_invite.id, p_actor_user_id, p_ip_key, 'redeem', 'already_member', p_request_id, true
    );
    return jsonb_build_object(
      'result', 'already_member', 'room_id', v_invite.room_id,
      'member_id', v_existing.id, 'role', v_existing.role
    );
  end if;

  if exists (
    select 1 from public.room_members
    where room_id = v_invite.room_id and nickname = trim(p_nickname)
  ) then
    perform public.record_invitation_outcome(
      v_invite.id, p_actor_user_id, p_ip_key, 'redeem', 'invite_invalid', p_request_id, false
    );
    return jsonb_build_object('result', 'invite_invalid');
  end if;

  insert into public.room_members(room_id, user_id, nickname, role, color)
  values (v_invite.room_id, p_actor_user_id, trim(p_nickname), v_invite.grant_role, p_color)
  returning id into v_member_id;

  update public.room_invites
  set used_count = used_count + 1,
      status = case when used_count + 1 >= max_uses then 'exhausted' else status end
  where id = v_invite.id;

  perform public.record_invitation_outcome(
    v_invite.id, p_actor_user_id, p_ip_key, 'redeem', 'invite_redeemed', p_request_id, true
  );
  return jsonb_build_object(
    'result', 'invite_redeemed', 'room_id', v_invite.room_id,
    'member_id', v_member_id, 'role', v_invite.grant_role
  );
end;
$$;

create or replace function public.preview_room_invite(
  p_token_hash text, p_ip_key text, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_invite public.room_invites%rowtype;
  v_result text;
  v_preview jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service authorization is required.';
  end if;
  select * into v_invite from public.room_invites where token_hash = p_token_hash for update;
  if not found then
    perform public.record_invitation_outcome(
      null, null, p_ip_key, 'preview', 'invite_invalid', p_request_id, false
    );
    return jsonb_build_object('result', 'invite_invalid');
  end if;
  v_result := case
    when v_invite.status <> 'active' then 'invite_' || v_invite.status
    when v_invite.expires_at <= now() then 'invite_expired'
    when v_invite.used_count >= v_invite.max_uses then 'invite_exhausted'
    else 'active' end;
  if v_result = 'active' then
    select jsonb_build_object(
      'result', 'active', 'roomName', r.name, 'roomDescription', r.description,
      'inviterDisplayName', p.display_name, 'grantRole', v_invite.grant_role,
      'expiresAt', v_invite.expires_at
    ) into v_preview from public.scheduling_rooms r
    join public.profiles p on p.id = v_invite.created_by_user_id
    where r.id = v_invite.room_id
      and r.status = 'active' and r.restriction_state = 'active';
    if v_preview is null then v_result := 'invite_invalid'; end if;
  end if;
  perform public.record_invitation_outcome(
    v_invite.id, null, p_ip_key, 'preview', v_result, p_request_id, v_result = 'active'
  );
  return coalesce(v_preview, jsonb_build_object('result', v_result));
end;
$$;

create or replace function public.apply_admin_sanction(
  p_target_type text, p_target_id uuid, p_sanction_type text,
  p_reason text, p_ends_at timestamptz, p_request_id text
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
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
) returns void language plpgsql security definer set search_path = public, extensions as $$
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

create or replace function public.list_admin_users(
  p_query text, p_offset integer, p_limit integer, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_mode text;
  v_rows jsonb;
  v_total integer;
  v_query text := nullif(trim(p_query), '');
begin
  if p_offset < 0 or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid administrator user page.';
  end if;
  if public.has_service_capability('user_room.read') then
    v_mode := 'full';
  elsif v_query is not null and char_length(v_query) >= 2 and v_query !~ '[%_]'
        and public.has_service_capability('user_room.lookup_limited') then
    v_mode := 'lookup';
  elsif v_query is null and public.has_service_capability('user_room.read_masked') then
    v_mode := 'masked';
  else
    raise exception 'Administrator user read is not authorized.';
  end if;

  select count(*) into v_total from public.profiles
  where v_mode <> 'lookup' or display_name ilike '%' || v_query || '%';
  select coalesce(jsonb_agg(to_jsonb(page_row)), '[]'::jsonb) into v_rows
  from (
    select id,
      case when v_mode = 'masked' then left(display_name, 1) || '***' else display_name end as display_name,
      account_state, created_at
    from public.profiles
    where v_mode <> 'lookup' or display_name ilike '%' || v_query || '%'
    order by created_at desc
    offset p_offset limit p_limit
  ) page_row;
  perform public.append_audit_event(
    'admin.users_read', 'admin', auth.uid()::text, 'account', 'user-list',
    'success', 'admin_users_read', p_request_id,
    jsonb_build_object('operation', 'read', 'scope', v_mode, 'count', jsonb_array_length(v_rows))
  );
  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

create or replace function public.grant_service_role(
  p_user_id uuid, p_role text, p_reason text, p_request_id text
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_assignment_id uuid;
begin
  if not public.has_service_capability('service_role.manage')
     or not exists (
       select 1 from public.profiles
       where id = auth.uid() and account_state = 'active'
         and last_reauthenticated_at >= now() - interval '10 minutes'
     ) then
    raise exception 'Service role management is not authorized.';
  end if;
  if p_role not in ('super_admin', 'operations_admin', 'support_admin', 'auditor')
     or char_length(trim(coalesce(p_reason, ''))) not between 1 and 500
     or not exists (select 1 from public.profiles where id = p_user_id and account_state <> 'deleted') then
    raise exception 'Invalid service role assignment.';
  end if;

  insert into public.service_role_assignments(user_id, role, granted_by_user_id, reason)
  values (p_user_id, p_role, auth.uid(), trim(p_reason))
  returning id into v_assignment_id;

  perform public.append_audit_event(
    'service_role.granted', 'admin', auth.uid()::text, 'account', p_user_id::text,
    'success', 'service_role_granted', p_request_id,
    jsonb_build_object('operation', 'grant', 'role', p_role)
  );
  return v_assignment_id;
end;
$$;

create or replace function public.revoke_service_role(
  p_assignment_id uuid, p_target_user_id uuid, p_reason text, p_request_id text
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_assignment public.service_role_assignments%rowtype;
begin
  if not public.has_service_capability('service_role.manage')
     or not exists (
       select 1 from public.profiles
       where id = auth.uid() and account_state = 'active'
         and last_reauthenticated_at >= now() - interval '10 minutes'
     ) then
    raise exception 'Service role management is not authorized.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'A revocation reason is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('service_role:super_admin'));
  select * into v_assignment from public.service_role_assignments
  where id = p_assignment_id and user_id = p_target_user_id and revoked_at is null
  for update;
  if not found then raise exception 'Active service role assignment was not found.'; end if;

  update public.service_role_assignments
  set revoked_by_user_id = auth.uid(), revoked_at = now()
  where id = p_assignment_id;

  perform public.append_audit_event(
    'service_role.revoked', 'admin', auth.uid()::text, 'account', p_target_user_id::text,
    'success', 'service_role_revoked', p_request_id,
    jsonb_build_object('operation', 'revoke', 'role', v_assignment.role)
  );
end;
$$;

create or replace function public.count_active_super_admins()
returns integer language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.has_service_capability('service_role.manage') then
    raise exception 'Service role management is not authorized.';
  end if;
  return (select count(*)::integer from public.service_role_assignments where role = 'super_admin' and revoked_at is null);
end;
$$;

create or replace function public.update_admin_report(
  p_report_id uuid, p_status text, p_assigned_to_user_id uuid, p_assignment_specified boolean,
  p_reason_code text, p_request_id text
) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.has_service_capability('report_sanction.manage') then
    raise exception 'Report management is not authorized.';
  end if;
  if p_status not in ('open', 'investigating', 'resolved', 'dismissed')
     or char_length(trim(coalesce(p_reason_code, ''))) not between 1 and 100 then
    raise exception 'Invalid report update.';
  end if;
  if p_assignment_specified and p_assigned_to_user_id is not null and not exists (
    select 1 from public.service_role_assignments
    where user_id = p_assigned_to_user_id and revoked_at is null and role in ('super_admin', 'operations_admin')
  ) then
    raise exception 'Report assignee is not authorized.';
  end if;

  update public.reports
  set status = p_status,
      assigned_to_user_id = case when p_assignment_specified then p_assigned_to_user_id else assigned_to_user_id end,
      resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end
  where id = p_report_id;
  if not found then raise exception 'Report was not found.'; end if;

  perform public.append_audit_event(
    'report.updated', 'admin', auth.uid()::text, 'report', p_report_id::text,
    'success', left(trim(p_reason_code), 100), p_request_id,
    jsonb_build_object('operation', 'update', 'status', p_status)
  );
end;
$$;

create or replace function public.release_ip_block(
  p_block_id uuid, p_reason text, p_request_id text
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_block public.ip_blocks%rowtype;
  v_policy text;
  v_scope text;
  v_hard_limit integer;
begin
  if not public.has_service_capability('ip_block.release') then
    raise exception 'IP block release is not authorized.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 1000 then
    raise exception 'An IP block release reason is required.';
  end if;

  select * into v_block from public.ip_blocks where id = p_block_id and released_at is null for update;
  if not found then raise exception 'Active IP block was not found.'; end if;
  update public.ip_blocks
  set released_by_user_id = auth.uid(), released_at = now(), release_source = 'manual', release_reason = trim(p_reason)
  where id = p_block_id;

  select policy, scope into v_policy, v_scope from public.request_control_events
  where subject_key = v_block.ip_key and action = 'block'
  order by occurred_at desc limit 1;
  v_policy := coalesce(v_policy, 'general');
  v_scope := coalesce(v_scope, 'general_ip');
  select hard_limit into v_hard_limit from public.request_control_policies where policy = v_policy;
  insert into public.request_control_events(
    subject_key, scope, policy, action, request_count, applied_limit,
    retry_after_seconds, request_id
  ) values (v_block.ip_key, v_scope, v_policy, 'manual_release', 0, v_hard_limit, 0, p_request_id);

  perform public.append_audit_event(
    'ip_block.released', 'admin', auth.uid()::text, 'ip_block', p_block_id::text,
    'success', 'ip_block_released', p_request_id,
    jsonb_build_object('operation', 'release')
  );
end;
$$;

create or replace function public.update_request_control_policy(
  p_policy text, p_window_seconds integer, p_soft_limit integer, p_hard_limit integer,
  p_repeated_excess_limit integer, p_repeated_excess_window_seconds integer,
  p_block_seconds integer, p_delay_min_ms integer, p_delay_max_ms integer,
  p_reason text, p_request_id text
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_policy public.request_control_policies%rowtype;
  v_previous public.request_control_policies%rowtype;
begin
  if not public.has_service_capability('restriction.manage') then
    raise exception 'Request policy management is not authorized.';
  end if;
  if p_policy not in ('general', 'sensitive')
     or p_window_seconds not between 1 and 3600
     or p_soft_limit < 1 or p_hard_limit < p_soft_limit or p_hard_limit > 10000
     or p_repeated_excess_limit not between 1 and 20
     or p_repeated_excess_window_seconds not between 60 and 86400
     or p_block_seconds not between 60 and 86400
     or p_delay_min_ms not between 0 and 30000
     or p_delay_max_ms < p_delay_min_ms or p_delay_max_ms > 30000
     or char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'Invalid request-control policy.';
  end if;
  if p_policy = 'sensitive' and (p_soft_limit <> p_hard_limit or p_delay_min_ms <> 0 or p_delay_max_ms <> 0) then
    raise exception 'Sensitive policy cannot introduce a delay band.';
  end if;

  select * into v_previous from public.request_control_policies
  where policy = p_policy for update;
  if not found then raise exception 'Request-control policy was not found.'; end if;

  update public.request_control_policies set
    window_seconds = p_window_seconds,
    soft_limit = p_soft_limit,
    hard_limit = p_hard_limit,
    repeated_excess_limit = p_repeated_excess_limit,
    repeated_excess_window_seconds = p_repeated_excess_window_seconds,
    block_seconds = p_block_seconds,
    delay_min_ms = p_delay_min_ms,
    delay_max_ms = p_delay_max_ms,
    updated_by_user_id = auth.uid(), updated_at = now()
  where policy = p_policy
  returning * into v_policy;

  insert into public.request_control_policy_revisions(
    policy, previous_values, new_values, reason, changed_by_user_id, request_id
  ) values (
    p_policy,
    to_jsonb(v_previous) - 'updated_by_user_id',
    to_jsonb(v_policy) - 'updated_by_user_id',
    trim(p_reason), auth.uid(), p_request_id
  );

  perform public.append_audit_event(
    'request_policy.updated', 'admin', auth.uid()::text, 'request_policy', p_policy,
    'success', 'request_policy_updated', p_request_id,
    jsonb_build_object(
      'operation', 'update', 'scope', p_policy, 'count', p_hard_limit,
      'reason', left(trim(p_reason), 500)
    )
  );
  return to_jsonb(v_policy) - 'updated_by_user_id';
end;
$$;

create or replace function public.expire_request_blocks(p_request_id text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_block public.ip_blocks%rowtype;
  v_policy text;
  v_scope text;
  v_hard_limit integer;
  v_count integer := 0;
begin
  if not public.has_service_capability('ip_block.read')
     and not public.has_service_capability('ip_block.release') then
    raise exception 'IP block review is not authorized.';
  end if;
  for v_block in
    update public.ip_blocks
    set released_at = blocked_until, release_source = 'automatic', release_reason = 'duration_expired'
    where released_at is null and blocked_until <= now()
    returning *
  loop
    select policy, scope into v_policy, v_scope from public.request_control_events
    where subject_key = v_block.ip_key and action = 'block'
    order by occurred_at desc limit 1;
    v_policy := coalesce(v_policy, 'general');
    v_scope := coalesce(v_scope, 'general_ip');
    select hard_limit into v_hard_limit from public.request_control_policies where policy = v_policy;
    insert into public.request_control_events(
      subject_key, scope, policy, action, request_count, applied_limit,
      retry_after_seconds, request_id, occurred_at
    ) values (v_block.ip_key, v_scope, v_policy, 'automatic_release', 0, v_hard_limit, 0, p_request_id, v_block.blocked_until);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.submit_user_report(
  p_report_id uuid, p_target_type text, p_target_id uuid, p_reason_code text,
  p_detail_ciphertext text, p_detail_iv text, p_detail_auth_tag text,
  p_key_version integer, p_request_id text
) returns table(id uuid, status text) language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_active_account(auth.uid()) then
    raise exception 'An active account is required.';
  end if;
  if p_target_type not in ('account', 'room')
     or char_length(trim(coalesce(p_reason_code, ''))) not between 1 and 100
     or ((p_detail_ciphertext is null or p_detail_iv is null or p_detail_auth_tag is null or p_key_version is null)
       and not (p_detail_ciphertext is null and p_detail_iv is null and p_detail_auth_tag is null and p_key_version is null))
     or (p_key_version is not null and p_key_version < 1) then
    raise exception 'Invalid report.';
  end if;
  if (p_target_type = 'account' and not exists (select 1 from public.profiles where id = p_target_id and account_state <> 'deleted'))
     or (p_target_type = 'room' and not exists (select 1 from public.scheduling_rooms where id = p_target_id)) then
    raise exception 'Report target was not found.';
  end if;

  insert into public.reports(
    id, reporter_user_id, target_type, target_id, reason_code,
    detail_ciphertext, detail_iv, detail_auth_tag, key_version
  ) values (
    p_report_id, auth.uid(), p_target_type, p_target_id, trim(p_reason_code),
    p_detail_ciphertext, p_detail_iv, p_detail_auth_tag, p_key_version
  );

  perform public.append_audit_event(
    'report.submitted', 'user', auth.uid()::text, 'report', p_report_id::text,
    'success', 'report_submitted', p_request_id,
    jsonb_build_object('operation', 'create', 'category', p_target_type)
  );
  return query select p_report_id, 'open'::text;
end;
$$;

create or replace function public.record_admin_read(
  p_resource text, p_request_id text, p_count integer
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_allowed boolean := false;
  v_target_type text := 'admin_read';
begin
  v_allowed := case p_resource
    when 'users' then public.has_service_capability('user_room.read') or public.has_service_capability('user_room.read_masked')
    when 'users.lookup' then public.has_service_capability('user_room.lookup_limited')
    when 'rooms' then public.has_service_capability('user_room.read') or public.has_service_capability('user_room.read_masked')
    when 'reports' then public.has_service_capability('report_sanction.read') or public.has_service_capability('report_sanction.manage')
    when 'sanctions' then public.has_service_capability('report_sanction.read') or public.has_service_capability('report_sanction.manage')
    when 'audit' then public.has_service_capability('audit.read_full') or public.has_service_capability('audit.read_operations') or public.has_service_capability('audit.read_support') or public.has_service_capability('audit.read_masked')
    when 'ip-blocks' then public.has_service_capability('ip_block.read') or public.has_service_capability('ip_block.release')
    when 'request-policies' then public.has_service_capability('ip_block.read') or public.has_service_capability('ip_block.release') or public.has_service_capability('restriction.manage')
    when 'roles' then public.has_service_capability('service_role.manage')
    when 'inquiries' then public.has_service_capability('inquiry.read_content') or public.has_service_capability('inquiry.read_metadata')
    else false end;
  if not v_allowed or p_count < 0 then raise exception 'Administrator read is not authorized.'; end if;
  v_target_type := case p_resource
    when 'users' then 'account'
    when 'users.lookup' then 'account'
    when 'rooms' then 'room'
    when 'reports' then 'report'
    when 'sanctions' then 'sanction'
    when 'inquiries' then 'support_inquiry'
    when 'ip-blocks' then 'ip_block'
    when 'request-policies' then 'ip_block'
    when 'roles' then 'account'
    else 'audit' end;
  perform public.append_audit_event(
    'admin.read', 'admin', auth.uid()::text, v_target_type, p_resource,
    'success', 'admin_read', p_request_id,
    jsonb_build_object('operation', 'read', 'scope', p_resource, 'count', p_count)
  );
end;
$$;

create or replace function public.export_private_profile(p_request_id text)
returns table (
  phone_ciphertext text, phone_iv text, phone_auth_tag text,
  birth_date_ciphertext text, birth_date_iv text, birth_date_auth_tag text,
  key_version integer
) language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and account_state <> 'deleted'
      and last_reauthenticated_at >= now() - interval '10 minutes'
  ) then
    raise exception 'Recent reauthentication is required.';
  end if;
  perform public.append_audit_event(
    'privacy.profile_accessed', 'user', auth.uid()::text, 'account', auth.uid()::text,
    'success', 'privacy_exported', p_request_id,
    jsonb_build_object('operation', 'export')
  );
  return query
    select p.phone_ciphertext, p.phone_iv, p.phone_auth_tag,
      p.birth_date_ciphertext, p.birth_date_iv, p.birth_date_auth_tag, p.key_version
    from public.private_profiles p where p.user_id = auth.uid();
end;
$$;

create or replace function public.correct_private_profile_phone(
  p_phone_ciphertext text, p_phone_iv text, p_phone_auth_tag text,
  p_phone_lookup_hash text, p_key_version integer, p_request_id text
) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and account_state <> 'deleted'
      and last_reauthenticated_at >= now() - interval '10 minutes'
  ) then
    raise exception 'Recent reauthentication is required.';
  end if;
  if p_key_version < 1 or not (
    (p_phone_ciphertext is null and p_phone_iv is null and p_phone_auth_tag is null and p_phone_lookup_hash is null)
    or (p_phone_ciphertext is not null and p_phone_iv is not null and p_phone_auth_tag is not null and p_phone_lookup_hash is not null)
  ) then
    raise exception 'Invalid encrypted phone value.';
  end if;
  update public.private_profiles set
    phone_ciphertext = p_phone_ciphertext, phone_iv = p_phone_iv,
    phone_auth_tag = p_phone_auth_tag, phone_lookup_hash = p_phone_lookup_hash,
    key_version = p_key_version, updated_at = now()
  where user_id = auth.uid();
  if not found then raise exception 'Private profile was not found.'; end if;
  perform public.append_audit_event(
    'privacy.profile_corrected', 'user', auth.uid()::text, 'account', auth.uid()::text,
    'success', 'phone_corrected', p_request_id,
    jsonb_build_object('operation', 'correct')
  );
end;
$$;

create or replace function public.begin_account_withdrawal(
  p_subject_key text, p_request_id text
) returns timestamptz language plpgsql security definer set search_path = public, extensions as $$
declare
  v_now timestamptz := now();
  v_due timestamptz := v_now + interval '7 days';
  v_prior text;
begin
  if auth.uid() is null or coalesce(p_subject_key, '') = '' then
    raise exception 'Withdrawal is not authorized.';
  end if;
  select account_state into v_prior from public.profiles
  where id = auth.uid() and account_state in ('active', 'restricted', 'suspended')
    and last_reauthenticated_at >= v_now - interval '10 minutes'
  for update;
  if v_prior is null then raise exception 'Withdrawal is not allowed in the current state.'; end if;
  perform set_config('app.profile_transition', 'allowed', true);
  update public.profiles set account_state = 'deletion_pending',
    deletion_requested_at = v_now, deletion_due_at = v_due,
    deletion_subject_key = p_subject_key
  where id = auth.uid();
  insert into public.deletion_records(subject_key, requested_at, due_at, prior_account_state, result_code)
  values (p_subject_key, v_now, v_due, v_prior, 'pending')
  on conflict (subject_key) do update set requested_at = excluded.requested_at,
    due_at = excluded.due_at, completed_at = null, replayed_at = null,
    prior_account_state = excluded.prior_account_state, result_code = 'pending';
  perform public.append_audit_event(
    'privacy.withdrawal_requested', 'user', auth.uid()::text, 'account', p_subject_key,
    'success', 'withdrawal_requested', p_request_id,
    jsonb_build_object('operation', 'withdraw', 'status', 'deletion_pending')
  );
  return v_due;
end;
$$;

create or replace function public.cancel_account_withdrawal(
  p_subject_key text, p_request_id text
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_prior text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid()
      and account_state = 'deletion_pending' and deletion_due_at > now()
      and last_reauthenticated_at >= now() - interval '10 minutes'
  ) then
    raise exception 'Withdrawal cancellation is not authorized.';
  end if;
  select prior_account_state into v_prior from public.deletion_records
  where subject_key = p_subject_key and completed_at is null and result_code = 'pending'
  for update;
  if v_prior is null then raise exception 'Irreversible deletion has started.'; end if;
  perform set_config('app.profile_transition', 'allowed', true);
  update public.profiles set account_state = v_prior,
    deletion_requested_at = null, deletion_due_at = null, deletion_subject_key = null
  where id = auth.uid();
  update public.deletion_records set result_code = 'cancelled' where subject_key = p_subject_key;
  perform public.append_audit_event(
    'privacy.withdrawal_cancelled', 'user', auth.uid()::text, 'account', p_subject_key,
    'success', 'withdrawal_cancelled', p_request_id,
    jsonb_build_object('operation', 'cancel', 'status', v_prior)
  );
  return v_prior;
end;
$$;

create or replace function public.finalize_due_account_deletion(
  p_user_id uuid, p_subject_key text, p_request_id text
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Maintenance authorization is required.'; end if;
  if not exists (
    select 1 from public.profiles p join public.deletion_records d
      on d.subject_key = p.deletion_subject_key
    where p.id = p_user_id and p.account_state = 'deletion_pending'
      and p.deletion_subject_key = p_subject_key and p.deletion_due_at <= now()
      and d.completed_at is null and d.result_code = 'pending'
  ) then return false; end if;

  delete from public.support_inquiry_messages where inquiry_id in (
    select id from public.support_inquiries where user_id = p_user_id
  );
  delete from public.support_inquiries where user_id = p_user_id;
  delete from public.guardian_consents where child_user_id = p_user_id;
  delete from public.account_email_references where user_id = p_user_id;
  delete from public.private_profiles where user_id = p_user_id;
  update public.room_members set nickname = '탈퇴한 사용자', color = '#9ca3af'
    where user_id = p_user_id;
  perform set_config('app.audit_maintenance', 'allowed', true);
  update public.audit_events set
    actor_key = case when actor_key = p_user_id::text then p_subject_key else actor_key end,
    target_key = case when target_key = p_user_id::text then p_subject_key else target_key end
  where actor_key = p_user_id::text or target_key = p_user_id::text;
  perform set_config('app.profile_transition', 'allowed', true);
  update public.profiles set
    email = p_subject_key || '@deleted.invalid', name = '탈퇴한 사용자', display_name = '탈퇴한 사용자',
    phone = null, status = 'inactive', account_state = 'deleted', is_under_14 = false,
    terms_version = null, privacy_version = null, terms_accepted_at = null, privacy_accepted_at = null,
    session_started_at = null, last_seen_at = null, last_reauthenticated_at = null
  where id = p_user_id;
  update public.deletion_records set completed_at = now(), result_code = 'deleted'
  where subject_key = p_subject_key and completed_at is null;
  perform public.append_audit_event(
    'privacy.deletion_completed', 'system', 'privacy-maintenance', 'account', p_subject_key,
    'success', 'deletion_completed', p_request_id,
    jsonb_build_object('operation', 'delete', 'status', 'deleted')
  );
  return true;
end;
$$;

create or replace function public.cleanup_expired_security_data(p_request_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_audit integer; v_violations integer; v_counters integer; v_inquiries integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Maintenance authorization is required.'; end if;
  perform set_config('app.audit_maintenance', 'allowed', true);
  delete from public.audit_events where retention_until <= now();
  get diagnostics v_audit = row_count;
  delete from public.rate_limit_violations where retention_until <= now();
  get diagnostics v_violations = row_count;
  delete from public.rate_limit_counters where updated_at < now() - interval '2 days';
  get diagnostics v_counters = row_count;
  delete from public.support_inquiries where retention_until is not null and retention_until <= now();
  get diagnostics v_inquiries = row_count;
  perform public.append_audit_event(
    'privacy.retention_cleanup', 'system', 'privacy-maintenance', 'retention', 'expired-records',
    'success', 'retention_cleanup', p_request_id,
    jsonb_build_object('operation', 'cleanup', 'count', v_audit + v_violations + v_counters + v_inquiries)
  );
  return jsonb_build_object('audit', v_audit, 'violations', v_violations, 'counters', v_counters, 'inquiries', v_inquiries);
end;
$$;

create or replace function public.quarantine_restored_deleted_subject(
  p_subject_key text, p_request_id text
) returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Maintenance authorization is required.'; end if;
  select id into v_user_id from public.profiles
  where deletion_subject_key = p_subject_key and account_state <> 'deleted' limit 1 for update;
  if v_user_id is null or not exists (
    select 1 from public.deletion_records where subject_key = p_subject_key and completed_at is not null
  ) then return false; end if;
  perform set_config('app.profile_transition', 'allowed', true);
  update public.profiles set account_state = 'deletion_pending', deletion_due_at = now()
  where id = v_user_id;
  update public.deletion_records set replayed_at = now(), result_code = 'restore_quarantined'
  where subject_key = p_subject_key;
  perform public.append_audit_event(
    'privacy.restore_quarantined', 'system', 'privacy-maintenance', 'account', p_subject_key,
    'success', 'deleted_subject_restored', p_request_id,
    jsonb_build_object('operation', 'reconcile', 'status', 'quarantined')
  );
  return true;
end;
$$;

create or replace function public.evaluate_request_limit(
  p_scope text, p_subject_key text, p_policy text, p_request_id text,
  p_now timestamptz default now()
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_policy public.request_control_policies%rowtype;
  v_window_start timestamptz;
  v_count integer;
  v_violations integer;
  v_delay_ms integer;
  v_retry_after integer;
  v_block public.ip_blocks%rowtype;
  v_expired public.ip_blocks%rowtype;
begin
  if p_subject_key !~ '^[a-f0-9]{64}$'
     or not ((p_scope = 'general_ip' and p_policy = 'general')
       or (p_scope in ('sensitive_ip', 'login_account') and p_policy = 'sensitive')) then
    raise exception 'Invalid request-control policy.';
  end if;
  select * into strict v_policy from public.request_control_policies where policy = p_policy;

  for v_expired in
    update public.ip_blocks
    set released_at = blocked_until, release_source = 'automatic', release_reason = 'duration_expired'
    where ip_key = p_subject_key and released_at is null and blocked_until <= p_now
    returning *
  loop
    insert into public.request_control_events(
      subject_key, scope, policy, action, request_count, applied_limit,
      retry_after_seconds, request_id, occurred_at
    ) values (
      p_subject_key, p_scope, p_policy, 'automatic_release', 0, v_policy.hard_limit,
      0, p_request_id, p_now
    );
  end loop;

  select * into v_block from public.ip_blocks
  where ip_key = p_subject_key and released_at is null and blocked_until > p_now
  order by blocked_until desc limit 1;
  if found then
    v_retry_after := ceil(extract(epoch from v_block.blocked_until - p_now));
    insert into public.request_control_events(
      subject_key, scope, policy, action, request_count, applied_limit,
      retry_after_seconds, request_id, occurred_at
    ) values (p_subject_key, p_scope, p_policy, 'block', 0, v_policy.hard_limit, v_retry_after, p_request_id, p_now);
    return jsonb_build_object('action', 'block', 'count', 0, 'limit', v_policy.hard_limit, 'window_seconds', v_policy.window_seconds,
      'retry_after', v_retry_after);
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from p_now) / v_policy.window_seconds) * v_policy.window_seconds);
  insert into public.rate_limit_counters(scope, subject_key, window_started_at, request_count, updated_at)
  values (p_scope, p_subject_key, v_window_start, 1, p_now)
  on conflict (scope, subject_key, window_started_at) do update
    set request_count = public.rate_limit_counters.request_count + 1, updated_at = excluded.updated_at
  returning request_count into v_count;

  if v_count > v_policy.hard_limit then
    insert into public.rate_limit_violations(subject_key, policy, occurred_at, request_id)
    values (p_subject_key, p_policy, p_now, p_request_id);
    select count(*) into v_violations from public.rate_limit_violations
    where subject_key = p_subject_key
      and occurred_at > p_now - make_interval(secs => v_policy.repeated_excess_window_seconds);
    if v_violations >= v_policy.repeated_excess_limit and p_scope <> 'login_account' then
      insert into public.ip_blocks(ip_key, blocked_at, blocked_until, source, reason)
      values (p_subject_key, p_now, p_now + make_interval(secs => v_policy.block_seconds), 'automatic', 'repeated_rate_limit_excess')
      on conflict (ip_key) where released_at is null do update
        set blocked_until = greatest(public.ip_blocks.blocked_until, excluded.blocked_until);
      insert into public.request_control_events(
        subject_key, scope, policy, action, request_count, applied_limit,
        retry_after_seconds, request_id, occurred_at
      ) values (p_subject_key, p_scope, p_policy, 'block', v_count, v_policy.hard_limit, v_policy.block_seconds, p_request_id, p_now);
      return jsonb_build_object('action', 'block', 'count', v_count, 'limit', v_policy.hard_limit, 'window_seconds', v_policy.window_seconds, 'retry_after', v_policy.block_seconds);
    end if;
    v_retry_after := greatest(1, v_policy.window_seconds - floor(extract(epoch from p_now - v_window_start)));
    insert into public.request_control_events(
      subject_key, scope, policy, action, request_count, applied_limit,
      retry_after_seconds, request_id, occurred_at
    ) values (p_subject_key, p_scope, p_policy, 'reject', v_count, v_policy.hard_limit, v_retry_after, p_request_id, p_now);
    return jsonb_build_object(
      'action', 'reject',
      'count', v_count, 'limit', v_policy.hard_limit, 'window_seconds', v_policy.window_seconds,
      'retry_after', v_retry_after
    );
  elsif v_count > v_policy.soft_limit then
    v_delay_ms := v_policy.delay_min_ms + floor(random() * (v_policy.delay_max_ms - v_policy.delay_min_ms + 1));
    insert into public.request_control_events(
      subject_key, scope, policy, action, request_count, applied_limit,
      delay_ms, request_id, occurred_at
    ) values (p_subject_key, p_scope, p_policy, 'delay', v_count, v_policy.hard_limit, v_delay_ms, p_request_id, p_now);
    return jsonb_build_object('action', 'delay', 'count', v_count, 'limit', v_policy.hard_limit, 'window_seconds', v_policy.window_seconds,
      'delay_ms', v_delay_ms);
  end if;
  return jsonb_build_object('action', 'allow', 'count', v_count, 'limit', v_policy.hard_limit, 'window_seconds', v_policy.window_seconds);
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
    or new.deletion_subject_key is distinct from old.deletion_subject_key
    or new.session_started_at is distinct from old.session_started_at
    or new.last_seen_at is distinct from old.last_seen_at
    or new.last_reauthenticated_at is distinct from old.last_reauthenticated_at
  ) then
    raise exception 'Protected profile fields require a dedicated server operation.';
  end if;
  return new;
end;
$$;

create or replace function public.record_verified_authentication(
  p_actor_user_id uuid, p_request_id text
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' or coalesce(p_request_id, '') = ''
     or not exists (select 1 from public.profiles where id = p_actor_user_id) then
    raise exception 'Verified authentication cannot be recorded.';
  end if;
  perform set_config('app.profile_transition', 'allowed', true);
  update public.profiles set
    session_started_at = v_now,
    last_seen_at = v_now,
    last_reauthenticated_at = v_now
  where id = p_actor_user_id;
  perform public.append_audit_event(
    'account.authentication_verified', 'user', p_actor_user_id::text,
    'account', p_actor_user_id::text, 'success', 'authentication_verified', p_request_id,
    jsonb_build_object('operation', 'authenticate')
  );
end;
$$;

create or replace function public.touch_session_activity(p_actor_user_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.role() <> 'service_role' or not public.is_active_account(p_actor_user_id) then
    raise exception 'Active session is required.';
  end if;
  perform set_config('app.profile_transition', 'allowed', true);
  update public.profiles set last_seen_at = now() where id = p_actor_user_id;
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
alter table public.user_notifications enable row level security;
alter table public.reports enable row level security;
alter table public.sanctions enable row level security;
alter table public.audit_events enable row level security;
alter table public.rate_limit_counters enable row level security;
alter table public.rate_limit_violations enable row level security;
alter table public.request_control_policies enable row level security;
alter table public.request_control_policy_revisions enable row level security;
alter table public.request_control_events enable row level security;
alter table public.ip_blocks enable row level security;
alter table public.deletion_records enable row level security;

drop policy if exists "profiles_service_admin_all" on public.profiles;
drop policy if exists "profiles_select_self_or_service_admin" on public.profiles;
create policy profiles_select_self on public.profiles for select
using (id = auth.uid());
drop policy if exists profiles_admin_capability_read on public.profiles;
drop policy if exists scheduling_rooms_admin_capability_read on public.scheduling_rooms;
create policy service_roles_select_self on public.service_role_assignments for select
using (user_id = auth.uid());
drop policy if exists service_roles_admin_manage_read on public.service_role_assignments;
drop policy if exists invitation_attempts_admin_read on public.invitation_attempts;
drop policy if exists admin_notifications_role_read on public.admin_notifications;
create policy user_notifications_owner_read on public.user_notifications for select
using (user_id = auth.uid());
create policy user_notifications_owner_mark_read on public.user_notifications for update
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reports_reporter_read on public.reports for select
using (reporter_user_id = auth.uid());
drop policy if exists reports_admin_read on public.reports;
drop policy if exists sanctions_admin_read on public.sanctions;
drop policy if exists audit_events_admin_read on public.audit_events;
drop policy if exists ip_blocks_admin_read on public.ip_blocks;
drop policy if exists request_control_policies_admin_read on public.request_control_policies;
drop policy if exists request_control_events_admin_read on public.request_control_events;

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
  public.guardian_consents, public.room_invites, public.rate_limit_counters,
  public.rate_limit_violations, public.deletion_records from anon, authenticated;
revoke all on public.support_inquiries, public.support_inquiry_messages from anon, authenticated;
revoke all on public.user_notifications from anon, authenticated;
grant select, update (read_at) on public.user_notifications to authenticated;
revoke insert, update, delete on public.service_role_assignments, public.reports,
  public.sanctions, public.ip_blocks, public.request_control_policies,
  public.request_control_events, public.request_control_policy_revisions from anon, authenticated;
grant select on public.service_role_assignments, public.reports to authenticated;
revoke select on public.audit_events, public.sanctions, public.ip_blocks,
  public.request_control_policies, public.request_control_events from authenticated;
revoke all on public.invitation_attempts, public.admin_notifications,
  public.request_control_policy_revisions from anon, authenticated;
revoke insert, update, delete on public.audit_events from anon, authenticated;
revoke all on function public.append_audit_event(text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_invitation_outcome(uuid, uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.evaluate_request_limit(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.preview_room_invite(text, text, text) from public, anon, authenticated;
revoke all on function public.redeem_room_invite(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_room_invite(uuid, uuid, text, text, text, timestamptz, integer, text, text) from public, anon, authenticated;
revoke all on function public.revoke_room_invite(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.replace_room_invite(uuid, uuid, uuid, text, text, timestamptz, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.apply_admin_sanction(text, uuid, text, text, timestamptz, text) from public, anon;
revoke all on function public.release_admin_sanction(uuid, text, text) from public, anon;
revoke all on function public.list_admin_users(text, integer, integer, text) from public, anon;
revoke all on function public.grant_service_role(uuid, text, text, text) from public, anon;
revoke all on function public.revoke_service_role(uuid, uuid, text, text) from public, anon;
revoke all on function public.count_active_super_admins() from public, anon;
revoke all on function public.update_admin_report(uuid, text, uuid, boolean, text, text) from public, anon;
revoke all on function public.release_ip_block(uuid, text, text) from public, anon;
revoke all on function public.update_request_control_policy(text, integer, integer, integer, integer, integer, integer, integer, integer, text, text) from public, anon;
revoke all on function public.expire_request_blocks(text) from public, anon;
revoke all on function public.submit_user_report(uuid, text, uuid, text, text, text, text, integer, text) from public, anon;
revoke all on function public.record_admin_read(text, text, integer) from public, anon;
revoke all on function public.complete_commercial_profile(text, boolean, text, text, text, text, text, text, text, text, text, text, integer, text) from public, anon;
revoke all on function public.record_guardian_verification(text, text, text, text, text, text) from public, anon;
revoke all on function public.export_private_profile(text) from public, anon;
revoke all on function public.correct_private_profile_phone(text, text, text, text, integer, text) from public, anon;
revoke all on function public.begin_account_withdrawal(text, text) from public, anon;
revoke all on function public.cancel_account_withdrawal(text, text) from public, anon;
revoke all on function public.finalize_due_account_deletion(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cleanup_expired_security_data(text) from public, anon, authenticated;
revoke all on function public.quarantine_restored_deleted_subject(text, text) from public, anon, authenticated;
revoke all on function public.service_actor_has_capability(uuid, text) from public, anon, authenticated;
revoke all on function public.list_support_inquiry_metadata(uuid, integer, integer, text) from public, anon, authenticated;
revoke all on function public.record_verified_authentication(uuid, text) from public, anon, authenticated;
revoke all on function public.touch_session_activity(uuid) from public, anon, authenticated;
revoke all on function public.create_support_inquiry(uuid, uuid, text, text, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.read_support_inquiry_content(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.claim_support_inquiry(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reply_support_inquiry(uuid, uuid, uuid, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.change_support_inquiry_status(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.enqueue_aging_inquiry_notifications(timestamptz, text) from public, anon, authenticated;
grant execute on function public.append_audit_event(text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.evaluate_request_limit(text, text, text, text, timestamptz) to service_role;
grant execute on function public.preview_room_invite(text, text, text) to service_role;
grant execute on function public.redeem_room_invite(uuid, text, text, text, text, text) to service_role;
grant execute on function public.create_room_invite(uuid, uuid, text, text, text, timestamptz, integer, text, text) to service_role;
grant execute on function public.revoke_room_invite(uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.replace_room_invite(uuid, uuid, uuid, text, text, timestamptz, integer, text, text, text) to service_role;
grant execute on function public.apply_admin_sanction(text, uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.release_admin_sanction(uuid, text, text) to authenticated;
grant execute on function public.list_admin_users(text, integer, integer, text) to authenticated;
grant execute on function public.grant_service_role(uuid, text, text, text) to authenticated;
grant execute on function public.revoke_service_role(uuid, uuid, text, text) to authenticated;
grant execute on function public.count_active_super_admins() to authenticated;
grant execute on function public.update_admin_report(uuid, text, uuid, boolean, text, text) to authenticated;
grant execute on function public.release_ip_block(uuid, text, text) to authenticated;
grant execute on function public.update_request_control_policy(text, integer, integer, integer, integer, integer, integer, integer, integer, text, text) to authenticated;
grant execute on function public.expire_request_blocks(text) to authenticated;
grant execute on function public.submit_user_report(uuid, text, uuid, text, text, text, text, integer, text) to authenticated;
grant execute on function public.record_admin_read(text, text, integer) to authenticated;
grant execute on function public.complete_commercial_profile(text, boolean, text, text, text, text, text, text, text, text, text, text, integer, text) to authenticated;
grant execute on function public.record_guardian_verification(text, text, text, text, text, text) to authenticated;
grant execute on function public.export_private_profile(text) to authenticated;
grant execute on function public.correct_private_profile_phone(text, text, text, text, integer, text) to authenticated;
grant execute on function public.begin_account_withdrawal(text, text) to authenticated;
grant execute on function public.cancel_account_withdrawal(text, text) to authenticated;
grant execute on function public.finalize_due_account_deletion(uuid, text, text) to service_role;
grant execute on function public.cleanup_expired_security_data(text) to service_role;
grant execute on function public.quarantine_restored_deleted_subject(text, text) to service_role;
grant execute on function public.service_actor_has_capability(uuid, text) to service_role;
grant execute on function public.list_support_inquiry_metadata(uuid, integer, integer, text) to service_role;
grant execute on function public.record_verified_authentication(uuid, text) to service_role;
grant execute on function public.touch_session_activity(uuid) to service_role;
grant execute on function public.create_support_inquiry(uuid, uuid, text, text, text, text, text, integer, text) to service_role;
grant execute on function public.read_support_inquiry_content(uuid, uuid, text) to service_role;
grant execute on function public.claim_support_inquiry(uuid, uuid, text) to service_role;
grant execute on function public.reply_support_inquiry(uuid, uuid, uuid, text, text, text, integer, text) to service_role;
grant execute on function public.change_support_inquiry_status(uuid, uuid, text, text) to service_role;
grant execute on function public.enqueue_aging_inquiry_notifications(timestamptz, text) to service_role;
grant execute on function public.has_service_capability(text) to authenticated;
grant execute on function public.is_active_account(uuid) to authenticated;
