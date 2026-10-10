import { Hono } from 'hono';
import type { AppAuth } from './auth.js';

export function createApp(auth: AppAuth) {
  const app = new Hono<{ Variables: { user: AppAuth['$Infer']['Session']['user'] } }>();
  app.get('/health', (c) => c.json({ ok: true }));
  app.get('/api/health', (c) => c.json({ ok: true }));
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
  // Everything added under /api after this middleware requires a real DB session.
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    const { response: session, headers } = await auth.api.getSession({
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
    for (const cookie of headers.getSetCookie()) c.header('Set-Cookie', cookie, { append: true });
    if (!session) return c.json({ error: 'unauthorized' }, 401);
    c.set('user', session.user);
    await next();
  });
  app.get('/api/me', (c) => {
    const { id, name, email } = c.get('user');
    return c.json({ user: { id, name, email } });
  });
  app.onError((error, c) => {
    console.error('API request failed', error.name);
    return c.json({ error: 'internal_error' }, 500);
  });
  return app;
}
