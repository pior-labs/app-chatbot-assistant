import { serve } from '@hono/node-server';
import postgres from 'postgres';
import { createApp } from './app.js';
import { createAuth } from './auth.js';
import { databaseConnection } from './env.js';
import { loadEnvironment } from './load-env.js';

loadEnvironment();
const connection = databaseConnection();
const client = postgres(connection.url, connection.options);
const app = createApp(createAuth(client));
const server = serve({
  fetch: app.fetch,
  port: Number(process.env.API_PORT ?? 3000),
  hostname: '0.0.0.0',
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    void client.end().then(() => process.exit(0));
  });
}
