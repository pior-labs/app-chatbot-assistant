import { defineConfig } from 'drizzle-kit';
import { drizzleDatabaseCredentials } from './src/env.js';
import { loadEnvironment } from './src/load-env.js';

loadEnvironment();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: drizzleDatabaseCredentials(),
});
