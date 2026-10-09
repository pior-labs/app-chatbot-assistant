import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createFixture, fixtureUsers } from './fixture.js';

let fixture: Awaited<ReturnType<typeof createFixture>>;
before(async () => {
  fixture = await createFixture();
});
after(async () => {
  await fixture?.close();
});
function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .filter((value) => !value.endsWith('='))
    .join('; ');
}
async function start() {
  const response = await fixture.app.request('http://localhost:5173/api/auth/sign-in/oauth2', {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId: 'auth-pior',
      callbackURL: '/',
      errorCallbackURL: '/?error=sign-in',
    }),
  });
  assert.equal(response.status, 200);
  const { url } = await response.json();
  return { url: new URL(url), stateCookie: cookie(response) };
}
async function approve(url: URL, user = 0) {
  url.pathname = '/approve';
  url.searchParams.set('user', String(user));
  const response = await fetch(url, { redirect: 'manual' });
  assert.equal(response.status, 302);
  return response.headers.get('location')!;
}
async function login(user = 0) {
  const state = await start();
  const callback = await approve(state.url, user);
  const response = await fixture.app.request(callback, { headers: { Cookie: state.stateCookie } });
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get('location')!, 'http://localhost:5173').pathname, '/');
  const sessionCookie = cookie(response);
  assert.match(sessionCookie, /szarans-assistant.session_token=/);
  return { sessionCookie, callback, state };
}

test('SSO creates two distinct local users linked to central subjects and survives a new auth instance', async () => {
  const sessions = await Promise.all([login(0), login(1)]);
  for (let i = 0; i < sessions.length; i++) {
    const response = await fixture.app.request('/api/me', {
      headers: { Cookie: sessions[i].sessionCookie },
    });
    assert.equal(response.status, 200);
    const { user } = await response.json();
    assert.equal(user.email, fixtureUsers[i].email);
    assert.equal(user.name, fixtureUsers[i].name);
    const rows =
      await fixture.client`select account_id from accounts where user_id = ${Number(user.id)}`;
    assert.equal(rows[0].account_id, fixtureUsers[i].sub);
  }
  assert.equal((await fixture.client`select * from users`).length, 2);
  const again = await login(0);
  assert.equal((await fixture.client`select * from users`).length, 2);
  const { createAuth } = await import('../src/auth.js');
  const restarted = createAuth(fixture.client, {
    baseURL: 'http://localhost:5173',
    issuer: fixture.issuer,
    discoveryUrl: `${fixture.issuer}/.well-known/openid-configuration`,
    clientId: 'assistant',
    clientSecret: 'fixture-client-secret',
    secret: 'fixture-session-secret-at-least-32-characters',
  });
  assert.equal(
    (await restarted.api.getSession({ headers: new Headers({ Cookie: again.sessionCookie }) }))
      ?.user.email,
    fixtureUsers[0].email,
  );
});

test('protected API rejects absent, unknown, tampered, foreign-app and expired sessions', async () => {
  const { sessionCookie } = await login();
  for (const value of [
    '',
    'szarans-assistant.session_token=invalid',
    `${sessionCookie}tampered`,
    sessionCookie.replaceAll('szarans-assistant', 'cookbook'),
  ]) {
    const response = await fixture.app.request('/api/me', { headers: { Cookie: value } });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  await fixture.client`update sessions set expires_at = now() - interval '1 day'`;
  assert.equal(
    (await fixture.app.request('/api/me', { headers: { Cookie: sessionCookie } })).status,
    401,
  );
});

test('protected route forwards renewed session cookie alongside database renewal', async () => {
  const { sessionCookie } = await login();
  await fixture.client`update sessions set updated_at = now() - interval '2 days', expires_at = now() + interval '1 day'`;
  const response = await fixture.app.request('/api/me', { headers: { Cookie: sessionCookie } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie')!, /szarans-assistant.session_token=/);
  assert.match(response.headers.get('set-cookie')!, /Max-Age=604800/);
  const rows =
    await fixture.client`select expires_at from sessions where expires_at > now() + interval '6 days'`;
  assert.ok(rows.length > 0);
});

test('sign-out revokes session server-side and does not call central logout', async () => {
  const logouts = fixture.centralLogouts();
  const { sessionCookie } = await login();
  const response = await fixture.app.request('/api/auth/sign-out', {
    method: 'POST',
    headers: {
      Cookie: sessionCookie,
      Origin: 'http://localhost:5173',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(fixture.centralLogouts(), logouts);
  assert.match(response.headers.get('set-cookie')!, /szarans-assistant.session_token=;/);
  assert.equal(
    (await fixture.app.request('/api/me', { headers: { Cookie: sessionCookie } })).status,
    401,
  );
  assert.equal((await login()).sessionCookie.includes('szarans-assistant.session_token='), true);
});

test('cookies are namespaced, HttpOnly, SameSite=Lax and secure in production', async () => {
  const context = await fixture.auth.$context;
  for (const name of ['session_token', 'state', 'oauth_state']) {
    const value = context.createAuthCookie(name);
    assert.equal(value.name, `szarans-assistant.${name}`);
    assert.equal(value.attributes.httpOnly, true);
    assert.equal(value.attributes.sameSite, 'lax');
  }
  const { createAuth } = await import('../src/auth.js');
  const production = createAuth(fixture.client, {
    baseURL: 'https://chat.szarans.ca',
    issuer: fixture.issuer,
    discoveryUrl: `${fixture.issuer}/.well-known/openid-configuration`,
    clientId: 'assistant',
    clientSecret: 'fixture-client-secret',
    secret: 'fixture-session-secret-at-least-32-characters',
  });
  const secure = (await production.$context).createAuthCookie('session_token');
  assert.equal(secure.name, '__Secure-szarans-assistant.session_token');
  assert.equal(secure.attributes.secure, true);
  const started = await start();
  assert.equal(
    started.url.searchParams.get('redirect_uri'),
    'http://localhost:5173/api/auth/oauth2/callback/auth-pior',
  );
  assert.equal(started.url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(started.stateCookie, /szarans-assistant.state=/);
});

test('state/cookie/issuer mismatch and callback replay cannot create sessions', async () => {
  const exchanges = fixture.tokenExchanges();
  for (const mode of [
    'wrong-state',
    'missing-cookie',
    'wrong-issuer',
    'missing-issuer',
    'expired-state',
  ]) {
    const state = await start();
    const callback = new URL(await approve(state.url));
    if (mode === 'wrong-state') callback.searchParams.set('state', 'wrong');
    if (mode === 'wrong-issuer') callback.searchParams.set('iss', 'https://evil.example');
    if (mode === 'missing-issuer') callback.searchParams.delete('iss');
    if (mode === 'expired-state')
      await fixture.client`update verifications set expires_at = now() - interval '1 day', value = jsonb_set(value::jsonb, '{expiresAt}', '0'::jsonb)::text`;
    const response = await fixture.app.request(callback.toString(), {
      headers: { Cookie: mode === 'missing-cookie' ? '' : state.stateCookie },
    });
    assert.doesNotMatch(cookie(response), /session_token=.+/);
    assert.match(response.headers.get('location')!, /error=/);
  }
  assert.equal(fixture.tokenExchanges(), exchanges);
  const valid = await login();
  const replay = await fixture.app.request(valid.callback, {
    headers: { Cookie: valid.state.stateCookie },
  });
  assert.doesNotMatch(cookie(replay), /session_token=.+/);
  assert.match(replay.headers.get('location')!, /error=/);
});

test('provider errors and invalid UserInfo do not establish sessions', async () => {
  for (const mode of ['token', 'profile', 'malformed']) {
    fixture.setFailToken(mode === 'token');
    fixture.setBadProfile(mode === 'profile');
    fixture.setMalformedProfile(mode === 'malformed');
    const state = await start();
    const callback = await approve(state.url);
    const response = await fixture.app.request(callback, {
      headers: { Cookie: state.stateCookie },
    });
    assert.doesNotMatch(cookie(response), /session_token=.+/);
    assert.match(response.headers.get('location')!, /error=/);
  }
  fixture.setFailToken(false);
  fixture.setBadProfile(false);
  fixture.setMalformedProfile(false);
});

test('cross-origin sign-in/sign-out and callback redirects are rejected', async () => {
  const { sessionCookie } = await login();
  for (const path of ['sign-out', 'sign-in/oauth2']) {
    const response = await fixture.app.request(`/api/auth/${path}`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
        Origin: 'https://evil.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ providerId: 'auth-pior', callbackURL: '/' }),
    });
    assert.equal(response.status, 403);
  }
  const response = await fixture.app.request('/api/auth/sign-in/oauth2', {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: 'auth-pior', callbackURL: 'https://evil.example' }),
  });
  assert.equal(response.status, 403);
});
