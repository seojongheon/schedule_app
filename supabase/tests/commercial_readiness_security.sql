-- Run against a disposable database after all migrations.
-- The transaction rolls back all fixture-independent assertions.

begin;

do $$
declare
  v_table text;
  v_rls boolean;
begin
  foreach v_table in array array[
    'private_profiles', 'account_email_references', 'guardian_consents',
    'service_role_assignments', 'invitation_attempts', 'support_inquiries',
    'support_inquiry_messages', 'admin_notifications', 'reports', 'sanctions',
    'audit_events', 'rate_limit_counters', 'rate_limit_violations', 'ip_blocks',
    'deletion_records'
  ] loop
    select c.relrowsecurity into v_rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v_table;
    assert v_rls is true, format('RLS must be enabled for public.%s', v_table);
  end loop;
end;
$$;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'audit_events'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  assert v_count = 0, 'Client audit mutation policies must not exist';

  select count(*) into v_count
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'audit_events'
    and t.tgname = 'audit_events_append_only'
    and not t.tgisinternal;
  assert v_count = 1, 'Append-only audit trigger must exist';
end;
$$;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'redeem_room_invite';

  assert v_definition is not null, 'redeem_room_invite must exist';
  assert position('FOR UPDATE' in upper(v_definition)) > 0,
    'Invitation redemption must lock the invitation row';
  assert position('used_count = used_count + 1' in v_definition) > 0,
    'Invitation use count must increment inside redemption';
  assert position('already_member' in v_definition) > 0,
    'Invitation redemption must be idempotent for existing members';
  assert position('record_invitation_outcome' in v_definition) > 0,
    'Every invitation redemption outcome must use the transactional recorder';
end;
$$;

do $$
declare
  v_definition text;
  v_count integer;
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'record_invitation_outcome';

  assert position('invitation_attempts' in v_definition) > 0,
    'Invitation outcomes must append an attempt record';
  assert position('append_audit_event' in v_definition) > 0,
    'Invitation outcomes must append an audit event';

  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('join_room_by_invite', 'generate_invite_code');
  assert v_count = 0, 'Legacy reusable plaintext invitation functions must be removed';

  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_scheduling_room';
  assert position('room_invites' in v_definition) = 0,
    'Room creation must not create an invitation implicitly';
end;
$$;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'evaluate_request_limit';

  assert v_definition is not null, 'evaluate_request_limit must exist';
  assert position('ON CONFLICT' in upper(v_definition)) > 0,
    'Request count must use an atomic upsert';
  assert position('repeated_excess_window_seconds' in v_definition) > 0
      and position('make_interval' in v_definition) > 0,
    'Repeated hard excess lookback must use the configured policy window';
  assert position('block_seconds' in v_definition) > 0,
    'Automatic block duration must use the configured policy value';
end;
$$;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name in ('append_audit_event', 'evaluate_request_limit')
    and grantee in ('PUBLIC', 'anon', 'authenticated');
  assert v_count = 0, 'Internal audit and rate-control functions must not be client executable';

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('private_profiles', 'account_email_references', 'room_invites')
    and roles && array['anon'::name, 'authenticated'::name];
  assert v_count = 0, 'Private envelopes and invitation hashes must not have client RLS policies';
end;
$$;

rollback;
