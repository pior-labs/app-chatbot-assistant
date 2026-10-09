import { serve } from '@hono/node-server';
import { createFixture } from './fixture.js';

const fixture = await createFixture();
const server = serve({ fetch: fixture.app.fetch, port: 3000, hostname: '127.0.0.1' });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    void fixture.close().then(() => process.exit(0));
  });
}
