import { config } from 'dotenv';
config({ path: '../../.env' });
config();
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { databaseUrl } from '../env.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
const journalFile = fileURLToPath(new URL('../../drizzle/meta/_journal.json', import.meta.url));

if (!existsSync(journalFile)) {
  throw new Error('Missing committed Drizzle migration journal');
}

const client = postgres(databaseUrl(), { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder });
  console.log('Database migrations complete.');
} finally {
  await client.end();
}
