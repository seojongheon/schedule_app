import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const helperUrl = new URL('./verified-identity.ts', import.meta.url);
const middlewareUrl = new URL('../../middleware.ts', import.meta.url);
const authUrl = new URL('../auth.ts', import.meta.url);

test('protected request identity uses verified JWT claims rather than a per-request user fetch', async () => {
  const [helper, middleware, auth] = await Promise.all([
    readFile(helperUrl, 'utf8'), readFile(middlewareUrl, 'utf8'), readFile(authUrl, 'utf8'),
  ]);

  assert.match(helper, /auth\.getClaims\(\)/);
  assert.match(middleware, /getVerifiedIdentity/);
  assert.match(auth, /getVerifiedIdentity/);
  assert.doesNotMatch(middleware, /auth\.getUser\(\)/);
  assert.doesNotMatch(auth, /auth\.getUser\(\)/);
});

test('middleware returns for public routes before creating a Supabase client', async () => {
  const source = await readFile(middlewareUrl, 'utf8');
  const publicReturn = source.indexOf('if (!protectedPath) return response;');
  const clientCreation = source.indexOf('const supabase = createServerClient');

  assert.ok(publicReturn >= 0 && publicReturn < clientCreation);
});
