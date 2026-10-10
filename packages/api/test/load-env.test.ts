import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { loadEnvironment } from '../src/load-env.js';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'assistant-env-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('local settings override .env while shell variables take priority', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, '.env'), 'DATABASE_URL=base-db\nAPI_PORT=3000\nWEB_PORT=5173\n');
  writeFileSync(join(root, '.env.local'), 'DATABASE_URL=local-db\nAPI_PORT=3001\n');
  const environment: NodeJS.ProcessEnv = { API_PORT: '4000' };

  loadEnvironment(root, environment);

  assert.equal(environment.DATABASE_URL, 'local-db');
  assert.equal(environment.API_PORT, '4000');
  assert.equal(environment.WEB_PORT, '5173');
});

test('local settings work without .env', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, '.env.local'), 'DATABASE_URL=local-db\n');
  const environment: NodeJS.ProcessEnv = {};

  loadEnvironment(root, environment);

  assert.equal(environment.DATABASE_URL, 'local-db');
});

test('.env remains a fallback when .env.local is absent', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, '.env'), 'DATABASE_URL=base-db\n');
  const environment: NodeJS.ProcessEnv = {};

  loadEnvironment(root, environment);

  assert.equal(environment.DATABASE_URL, 'base-db');
});

test('production ignores local credentials and keeps container variables', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, '.env'), 'DATABASE_URL=base-db\nAPI_PORT=3000\n');
  writeFileSync(join(root, '.env.local'), 'DATABASE_URL=local-db\nLOCAL_SECRET=local-only\n');
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'container-db',
  };

  loadEnvironment(root, environment);

  assert.equal(environment.DATABASE_URL, 'container-db');
  assert.equal(environment.API_PORT, '3000');
  assert.equal(environment.LOCAL_SECRET, undefined);
});

test('missing files leave supplied environment unchanged', (t) => {
  const root = fixture(t);
  const environment: NodeJS.ProcessEnv = { DATABASE_URL: 'shell-db' };

  loadEnvironment(root, environment);

  assert.deepEqual(environment, { DATABASE_URL: 'shell-db' });
});
