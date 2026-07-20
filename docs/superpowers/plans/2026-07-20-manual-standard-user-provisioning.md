# Manual Standard User Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and verify one active, non-admin Supabase user for login ID `rkdgusco` in the real migrated project without persisting its password or any server key.

**Architecture:** Run a temporary Node.js provisioning program outside the repository, using the existing Supabase Admin API dependency and the server-only key in `.env.migration-new`. The operation refuses to overwrite an existing Auth user, creates the Auth user and matching active profile, then verifies the Auth, profile, and role postconditions through independent reads.

**Tech Stack:** Node.js, `@supabase/supabase-js`, Supabase Auth Admin API, Supabase PostgREST

## Global Constraints

- Target only the Supabase project referenced by both `.env` and `.env.migration-new` (`xyxydxdqkmwvcvqzzvmg`).
- Normalize login ID `rkdgusco` to `rkdgusco@shared-schedule.local`.
- Set `status = 'active'`, `account_state = 'active'`, and `is_service_admin = false`.
- Do not create an active `service_role_assignments` row.
- Do not print or persist the password, publishable key, or server-only key.
- If the Auth user already exists, stop without changing its credentials or profile.
- Do not modify application source, migrations, environment files, or signup policy.

---

## File Structure

- Create temporarily: `/private/tmp/provision-standard-user.mjs` — performs preflight checks, provisioning, and postcondition verification; it is not added to Git.
- Modify: none in the application repository during execution.
- Read: `/Users/seojongheon/Desktop/scheduling/.env`
- Read: `/Users/seojongheon/Desktop/scheduling/.env.migration-new`

### Task 1: Provision and verify the real standard user

**Files:**
- Create temporarily: `/private/tmp/provision-standard-user.mjs`
- Read: `/Users/seojongheon/Desktop/scheduling/.env`
- Read: `/Users/seojongheon/Desktop/scheduling/.env.migration-new`
- Test: independent Auth, profile, and role reads within `/private/tmp/provision-standard-user.mjs`

**Interfaces:**
- Consumes: `STANDARD_USER_PASSWORD` from a hidden interactive shell variable and Supabase settings loaded from the two environment files.
- Produces: Auth user `rkdgusco@shared-schedule.local`, matching active `profiles` row, and a non-secret verification summary.

- [ ] **Step 1: Run a non-secret preflight**

Run a read-only command that parses both environment files without printing values. Confirm both URLs resolve to project ref `xyxydxdqkmwvcvqzzvmg`, `.env.migration-new` has `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, and `STANDARD_USER_PASSWORD` is not stored in either file.

Expected: `preflight: target and server credentials are configured; account password is not persisted`.

- [ ] **Step 2: Create the temporary provisioning program**

Create `/private/tmp/provision-standard-user.mjs` with this complete implementation:

```js
import { createClient } from '/Users/seojongheon/Desktop/scheduling/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';

const ROOT = '/Users/seojongheon/Desktop/scheduling';
const EXPECTED_REF = 'xyxydxdqkmwvcvqzzvmg';
const LOGIN_ID = 'rkdgusco';
const EMAIL = `${LOGIN_ID}@shared-schedule.local`;

function parseEnv(path) {
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    values[key] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

async function findUserByEmail(admin, email) {
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error('Auth user scan exceeded the safety page limit.');
}

const base = parseEnv(`${ROOT}/.env`);
const migrated = parseEnv(`${ROOT}/.env.migration-new`);
const supabaseUrl = migrated.NEXT_PUBLIC_SUPABASE_URL || base.NEXT_PUBLIC_SUPABASE_URL;
const serverKey = migrated.SUPABASE_SERVICE_ROLE_KEY || migrated.SUPABASE_SECRET_KEY;
const password = process.env.STANDARD_USER_PASSWORD;

if (!supabaseUrl || !serverKey || !password) {
  throw new Error('Required target, server credential, or interactive password is missing.');
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
if (projectRef !== EXPECTED_REF) {
  throw new Error(`Target project mismatch: ${projectRef}`);
}

const admin = createClient(supabaseUrl, serverKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

if (await findUserByEmail(admin, EMAIL)) {
  throw new Error(`Refusing to overwrite existing account: ${LOGIN_ID}`);
}

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email: EMAIL,
  password,
  email_confirm: true,
  user_metadata: { name: LOGIN_ID, login_id: LOGIN_ID },
});
if (createError) throw createError;
if (!created.user) throw new Error('Supabase did not return the created Auth user.');

const { error: profileError } = await admin.from('profiles').upsert({
  id: created.user.id,
  email: EMAIL,
  name: LOGIN_ID,
  phone: null,
  is_service_admin: false,
  status: 'active',
  display_name: LOGIN_ID,
  account_state: 'active',
  updated_at: new Date().toISOString(),
}, { onConflict: 'id' });
if (profileError) {
  throw new Error(`Auth user was created, but profile provisioning failed: ${profileError.message}`);
}

const { data: authRead, error: authReadError } = await admin.auth.admin.getUserById(created.user.id);
if (authReadError) throw authReadError;
const { data: profile, error: profileReadError } = await admin
  .from('profiles')
  .select('id,email,display_name,status,account_state,is_service_admin')
  .eq('id', created.user.id)
  .single();
if (profileReadError) throw profileReadError;
const { count: activeRoleCount, error: roleReadError } = await admin
  .from('service_role_assignments')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', created.user.id)
  .is('revoked_at', null);
if (roleReadError) throw roleReadError;

const valid = authRead.user.email?.toLowerCase() === EMAIL
  && Boolean(authRead.user.email_confirmed_at)
  && profile.email === EMAIL
  && profile.display_name === LOGIN_ID
  && profile.status === 'active'
  && profile.account_state === 'active'
  && profile.is_service_admin === false
  && activeRoleCount === 0;
if (!valid) throw new Error('Provisioning postcondition verification failed.');

console.log(`verified: ${LOGIN_ID}, active standard user, admin roles=0, project=${EXPECTED_REF}`);
```

- [ ] **Step 3: Execute with hidden password input**

Start an interactive Zsh command that uses `read -s` to populate `STANDARD_USER_PASSWORD`, exports it only for the child Node.js process, and unsets it afterward. Enter the user-provided password at the hidden prompt; do not place it in a command argument, file, or output.

Expected: `verified: rkdgusco, active standard user, admin roles=0, project=xyxydxdqkmwvcvqzzvmg`.

If the account already exists, expected safe failure: `Refusing to overwrite existing account: rkdgusco`. Do not update or delete it.

- [ ] **Step 4: Confirm repository integrity**

Run: `git status --short`

Expected: no application source, migration, environment, or credential file changes. The plan document itself may be the only uncommitted file.

- [ ] **Step 5: Report the postconditions**

Report only the login ID, active general-user status, absence of administrator roles, and target project ref. Do not repeat the password or any key.
