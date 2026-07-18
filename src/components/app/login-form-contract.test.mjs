import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('login form accepts a normalized administrator ID as well as an email address', async () => {
  const source = await readFile(new URL('./LoginForm.tsx', import.meta.url), 'utf8');
  assert.match(source, /account:\s*z\.string\(\)\.trim\(\)\.min\(1/);
  assert.match(source, /이메일 또는 관리자 ID/);
  assert.doesNotMatch(source, /account:\s*z\.string\(\)\.email\(/);
});
