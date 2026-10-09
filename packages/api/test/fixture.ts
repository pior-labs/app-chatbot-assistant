import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { createAuth } from '../src/auth.js';
import { createApp } from '../src/app.js';

export const fixtureUsers = [
  { sub: 'household-one', email: 'one@example.test', name: 'Household One', email_verified: true },
  { sub: 'household-two', email: 'two@example.test', name: 'Household Two', email_verified: true },
];

// Always allocate a new database. Never migrate/truncate an existing database.
export async function createFixture(baseURL = 'http://localhost:5173') {
  let container: string | undefined;
  let adminURL = process.env.TEST_DATABASE_URL;
  if (!adminURL) {
    container = execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '-d',
        '-e',
        'POSTGRES_PASSWORD=fixture-only',
        '-p',
        '127.0.0.1::5432',
        'postgres:17-alpine',
      ],
      { encoding: 'utf8' },
    ).trim();
    const port = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' })
      .trim()
      .split(':')
      .at(-1);
    adminURL = `postgresql://postgres:fixture-only@localhost:${port}/postgres`;
  }
  const admin = postgres(adminURL, { max: 1, connect_timeout: 1 });
  const database = `assistant_test_${randomUUID().replaceAll('-', '')}`;
  let client: ReturnType<typeof postgres> | undefined;
  let providerServer: ReturnType<typeof serve> | undefined;
  async function close() {
    if (providerServer)
      await new Promise<void>((resolve) => providerServer!.close(() => resolve()));
    if (client) await client.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
    if (container) execFileSync('docker', ['stop', '--time', '0', container], { stdio: 'ignore' });
  }
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await admin`select 1`;
        break;
      } catch (error) {
        if (attempt >= 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    await admin.unsafe(`CREATE DATABASE "${database}"`);
    const url = new URL(adminURL);
    url.pathname = `/${database}`;
    client = postgres(url.toString(), { max: 3 });
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
    const provider = new Hono();
    let issuer = '';
    let tokenExchanges = 0;
    let centralLogouts = 0;
    let failToken = false;
    let badProfile = false;
    let malformedProfile = false;
    const codes = new Map<string, { query: URLSearchParams; user: number }>();
    const tokens = new Map<string, number>();
    provider.get('/api/auth/.well-known/openid-configuration', (c) =>
      c.json({
        issuer,
        authorization_endpoint: `${issuer}/oauth2/authorize`,
        token_endpoint: `${issuer}/oauth2/token`,
        userinfo_endpoint: `${issuer}/oauth2/userinfo`,
        end_session_endpoint: `${issuer}/oauth2/end-session`,
        token_endpoint_auth_methods_supported: ['client_secret_post'],
        authorization_response_iss_parameter_supported: true,
      }),
    );
    provider.get('/api/auth/oauth2/authorize', (c) => {
      const query = new URL(c.req.url).searchParams;
      const links = fixtureUsers
        .map(
          (user, i) =>
            `<a href="/approve?${new URLSearchParams([...query, ['user', String(i)]]).toString().replaceAll('&', '&amp;')}">${user.name}</a>`,
        )
        .join('<br>');
      return c.html(`<html><body><h1>Fixture central SSO</h1>${links}</body></html>`);
    });
    provider.get('/approve', (c) => {
      const query = new URL(c.req.url).searchParams;
      const user = Number(query.get('user'));
      if (
        !fixtureUsers[user] ||
        query.get('client_id') !== 'assistant' ||
        query.get('code_challenge_method') !== 'S256'
      )
        return c.json({ error: 'invalid_request' }, 400);
      const code = randomUUID();
      codes.set(code, { query, user });
      const callback = new URL(query.get('redirect_uri')!);
      callback.searchParams.set('code', code);
      callback.searchParams.set('state', query.get('state')!);
      callback.searchParams.set('iss', issuer);
      return c.redirect(callback.toString());
    });
    provider.post('/api/auth/oauth2/token', async (c) => {
      const body = new URLSearchParams(await c.req.text());
      const code = body.get('code')!;
      const stored = codes.get(code);
      const challenge = createHash('sha256')
        .update(body.get('code_verifier') ?? '')
        .digest('base64url');
      if (
        failToken ||
        !stored ||
        challenge !== stored.query.get('code_challenge') ||
        body.get('client_id') !== 'assistant' ||
        body.get('client_secret') !== 'fixture-client-secret' ||
        body.get('redirect_uri') !== stored.query.get('redirect_uri') ||
        body.get('grant_type') !== 'authorization_code'
      )
        return c.json({ error: 'invalid_grant' }, 400);
      codes.delete(code);
      tokenExchanges++;
      const accessToken = randomUUID();
      tokens.set(accessToken, stored.user);
      // The pinned library must not trust these misleading, unsigned claims.
      const idToken = [
        'eyJhbGciOiJub25lIn0',
        Buffer.from(
          JSON.stringify({ sub: 'attacker', email: 'attacker@example.test', name: 'Attacker' }),
        ).toString('base64url'),
        '',
      ].join('.');
      return c.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'fixture-refresh',
        id_token: idToken,
      });
    });
    provider.get('/api/auth/oauth2/end-session', (c) => {
      centralLogouts++;
      return c.json({ ok: true });
    });
    provider.get('/api/auth/oauth2/userinfo', (c) => {
      const user = tokens.get(c.req.header('Authorization')?.replace('Bearer ', '') ?? '');
      if (user === undefined) return c.json({ error: 'unauthorized' }, 401);
      if (malformedProfile) return c.body('{invalid', 200, { 'Content-Type': 'application/json' });
      return c.json(badProfile ? { email: 'invalid' } : fixtureUsers[user]);
    });
    providerServer = serve({ fetch: provider.fetch, port: 0, hostname: '127.0.0.1' });
    await once(providerServer, 'listening');
    const port = (providerServer.address() as AddressInfo).port;
    issuer = `http://localhost:${port}/api/auth`;
    const auth = createAuth(client, {
      baseURL,
      issuer,
      discoveryUrl: `${issuer}/.well-known/openid-configuration`,
      clientId: 'assistant',
      clientSecret: 'fixture-client-secret',
      secret: 'fixture-session-secret-at-least-32-characters',
    });
    const app = createApp(auth);
    return {
      app,
      auth,
      client,
      issuer,
      close,
      tokenExchanges: () => tokenExchanges,
      centralLogouts: () => centralLogouts,
      setFailToken: (value: boolean) => {
        failToken = value;
      },
      setMalformedProfile: (value: boolean) => {
        malformedProfile = value;
      },
      setBadProfile: (value: boolean) => {
        badProfile = value;
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}
