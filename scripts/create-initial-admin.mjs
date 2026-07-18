import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

const LOCAL_ACCOUNT_DOMAIN = 'shared-schedule.local';
const ENV_FILES = ['.env.local', '.env'];

function loadLocalEnvFiles() {
  for (const file of ENV_FILES) {
    if (!existsSync(file)) {
      continue;
    }

    const content = readFileSync(file, 'utf8');

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, '');

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function requireAnyEnv(names) {
  const value = names.map((name) => process.env[name]).find(Boolean);

  if (!value) {
    throw new Error(`${names.join(' or ')} is required.`);
  }

  return value;
}

function optionalEnv(name, fallback) {
  return process.env[name] || fallback;
}

function assertStrongPassword(password) {
  if (password.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD must be at least 12 characters.');
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('INITIAL_ADMIN_PASSWORD must include upper/lowercase letters, a number, and a special character.');
  }
}

function normalizeLoginIdentifier(identifier) {
  const trimmed = identifier.trim().toLowerCase();

  if (!trimmed) {
    throw new Error('INITIAL_ADMIN_ID is required.');
  }

  if (trimmed.includes('@')) {
    return trimmed;
  }

  return `${trimmed}@${LOCAL_ACCOUNT_DOMAIN}`;
}

async function findUserByEmail(admin, email) {
  let page = 1;

  while (page < 50) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const found = data.users.find((user) => user.email?.toLowerCase() === email);

    if (found) {
      return found;
    }

    if (data.users.length < 100) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function main() {
  loadLocalEnvFiles();

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireAnyEnv(['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']);
  const loginId = requireEnv('INITIAL_ADMIN_ID');
  const password = requireEnv('INITIAL_ADMIN_PASSWORD');
  assertStrongPassword(password);
  const name = optionalEnv('INITIAL_ADMIN_NAME', '슈퍼관리자');
  const phone = process.env.INITIAL_ADMIN_PHONE || null;
  const email = normalizeLoginIdentifier(loginId);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let user = await findUserByEmail(admin, email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        login_id: loginId,
      },
    });

    if (error) {
      throw error;
    }

    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        name,
        login_id: loginId,
      },
    });

    if (error) {
      throw error;
    }

    user = data.user;
  }

  if (!user) {
    throw new Error('Failed to create or update the admin auth user.');
  }

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: user.id,
      email,
      name,
      phone,
      is_service_admin: true,
      status: 'active',
      display_name: name,
      account_state: 'active',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    throw profileError;
  }

  const { data: existingRole, error: roleLookupError } = await admin
    .from('service_role_assignments')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'super_admin')
    .is('revoked_at', null)
    .maybeSingle();

  if (roleLookupError) {
    throw roleLookupError;
  }

  if (!existingRole) {
    const { error: roleError } = await admin.from('service_role_assignments').insert({
      user_id: user.id,
      role: 'super_admin',
      granted_by_user_id: user.id,
      reason: 'Controlled initial administrator bootstrap',
    });

    if (roleError) {
      throw roleError;
    }
  }

  console.log(`Initial service admin is ready: ${loginId} (${email})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
