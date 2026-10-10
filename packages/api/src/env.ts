import { readFileSync } from 'node:fs';

export function databaseUrl(): string {
  const file = process.env.DATABASE_URL_FILE?.trim();
  if (file) {
    const value = readFileSync(file, 'utf8').trim();
    if (!value) throw new Error(`Database URL file is empty: ${file}`);
    return value;
  }

  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error('Set DATABASE_URL or DATABASE_URL_FILE');
  }

  return value;
}

// postgres-js needs an explicit host option for Cookbook-style Unix socket URLs.
export function databaseConnection(url = databaseUrl()) {
  const parsedUrl = new URL(url);
  const socketHost = parsedUrl.searchParams.get('host');
  parsedUrl.searchParams.delete('host');

  return {
    url: parsedUrl.toString(),
    options: socketHost ? { host: socketHost } : {},
  };
}

// Drizzle Kit's URL form cannot pass postgres-js's separate socket-host option.
export function drizzleDatabaseCredentials(url = databaseUrl()) {
  const connection = databaseConnection(url);
  if (!connection.options.host) return { url };

  const parsedUrl = new URL(connection.url);
  return {
    host: connection.options.host,
    port: Number(parsedUrl.port || '5432'),
    user: decodeURIComponent(parsedUrl.username) || undefined,
    password: decodeURIComponent(parsedUrl.password) || undefined,
    database: decodeURIComponent(parsedUrl.pathname.slice(1)),
  };
}

export function authEnvironment() {
  const required = (key: string) => {
    const value = process.env[key]?.trim();
    if (!value || value.startsWith('replace-with-')) throw new Error(`Set ${key}`);
    return value;
  };
  const secret = required('BETTER_AUTH_SECRET');
  if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
  const baseURL = required('BETTER_AUTH_URL');
  const issuer = required('CENTRAL_AUTH_ISSUER');
  for (const value of [baseURL, issuer]) {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        url.hostname === 'localhost' &&
        process.env.NODE_ENV !== 'production'
      )
    ) {
      throw new Error('Auth URLs require HTTPS (localhost HTTP is allowed outside production)');
    }
  }
  if (new URL(baseURL).pathname !== '/') throw new Error('BETTER_AUTH_URL must be an origin');
  return {
    secret,
    baseURL,
    issuer,
    discoveryUrl: `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`,
    clientId: required('CENTRAL_AUTH_CLIENT_ID'),
    clientSecret: required('CENTRAL_AUTH_CLIENT_SECRET'),
  };
}
