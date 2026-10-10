import assert from 'node:assert/strict';
import { test } from 'node:test';
import postgres from 'postgres';
import { databaseConnection, drizzleDatabaseCredentials } from '../src/env.js';

test('local peer authentication uses the socket host rather than TCP localhost', async () => {
  const connection = databaseConnection(
    'postgresql://pior@localhost:5432/assistant_dev?host=/var/run/postgresql',
  );
  assert.equal(connection.url, 'postgresql://pior@localhost:5432/assistant_dev');
  assert.deepEqual(connection.options, { host: '/var/run/postgresql' });

  // Inspect the real driver's resolved transport without opening a connection.
  const client = postgres(connection.url, connection.options);
  try {
    assert.deepEqual(client.options.host, ['/var/run/postgresql']);
    assert.equal(client.options.user, 'pior');
    assert.equal(client.options.database, 'assistant_dev');
  } finally {
    await client.end();
  }
});

test('socket paths are decoded and other connection parameters are preserved', () => {
  const connection = databaseConnection(
    'postgresql://pior@localhost/assistant_dev?host=%2Fvar%2Frun%2Fpostgresql&application_name=assistant',
  );
  assert.deepEqual(connection.options, { host: '/var/run/postgresql' });
  assert.equal(new URL(connection.url).searchParams.get('application_name'), 'assistant');
  assert.equal(new URL(connection.url).searchParams.has('host'), false);
});

test('production TCP credentials and TLS settings are unchanged', () => {
  const url = 'postgresql://assistant:fixture-password@postgres:5432/assistant?sslmode=require';
  assert.deepEqual(databaseConnection(url), { url, options: {} });
});

test('Drizzle credentials use socket transport with decoded user and database names', async () => {
  const credentials = drizzleDatabaseCredentials(
    'postgresql://peer%5Fuser:fixture%40password@localhost:5433/assistant%5Fdev?host=%2Fvar%2Frun%2Fpostgresql',
  );
  assert.deepEqual(credentials, {
    host: '/var/run/postgresql',
    port: 5433,
    user: 'peer_user',
    password: 'fixture@password',
    database: 'assistant_dev',
  });
  assert.ok('host' in credentials);
  const client = postgres(credentials);
  try {
    assert.deepEqual(client.options.host, ['/var/run/postgresql']);
    assert.deepEqual(client.options.port, [5433]);
    assert.equal(client.options.user, 'peer_user');
    assert.equal(client.options.database, 'assistant_dev');
  } finally {
    await client.end();
  }
});

test('Drizzle peer authentication has no password and defaults to port 5432', () => {
  assert.deepEqual(
    drizzleDatabaseCredentials(
      'postgresql://pior@localhost/assistant_dev?host=/var/run/postgresql',
    ),
    {
      host: '/var/run/postgresql',
      port: 5432,
      user: 'pior',
      password: undefined,
      database: 'assistant_dev',
    },
  );
});

test('Drizzle TCP credentials retain the original URL including TLS settings', () => {
  const url = 'postgresql://assistant:fixture-password@postgres:5432/assistant?sslmode=require';
  assert.deepEqual(drizzleDatabaseCredentials(url), { url });
});
