import { config } from 'dotenv';
import { serve } from '@hono/node-server';
import postgres from 'postgres';
import { createApp } from './app.js';
import { createAuth } from './auth.js';
import { databaseUrl } from './env.js';

// Workspace scripts execute inside packages/api; production executes at root.
config({ path: '../../.env' });
config();
const client = postgres(databaseUrl());
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
