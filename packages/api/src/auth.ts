import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { z } from 'zod';
import * as schema from './db/schema.js';
import { authEnvironment } from './env.js';

export function createAuth(client: ReturnType<typeof postgres>, env = authEnvironment()) {
  return betterAuth({
    baseURL: env.baseURL,
    secret: env.secret,
    trustedOrigins: [env.baseURL],
    database: drizzleAdapter(drizzle(client, { schema }), { provider: 'pg', schema }),
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: 'auth-pior',
            discoveryUrl: env.discoveryUrl,
            // Better Auth 1.7 takes the issuer and signing keys from discovery and
            // verifies each ID token's signature, issuer, audience and nonce. Requiring
            // it makes a discovery document without an issuer or JWKS disable the
            // provider instead of silently skipping verification.
            requireIdTokenVerification: true,
            clientId: env.clientId,
            clientSecret: env.clientSecret,
            scopes: ['openid', 'profile', 'email', 'offline_access'],
            pkce: true,
            // Sign-out revokes only the Assistant session. 1.7 would otherwise send the
            // browser to the provider's end-session endpoint from discovery.
            disableProviderLogout: true,
            accessType: 'offline',
            // Read the profile from authenticated UserInfo and validate it. Because the
            // result carries `sub`, Better Auth rejects it unless it matches the verified
            // ID token's subject, which is also the account key.
            getUserInfo: async (tokens) => {
              try {
                const response = await fetch(`${env.issuer}/oauth2/userinfo`, {
                  headers: { Authorization: `Bearer ${tokens.accessToken}` },
                  signal: AbortSignal.timeout(10_000),
                });
                if (!response.ok) return null;
                const parsed = z
                  .object({
                    sub: z.string().min(1),
                    email: z.email(),
                    name: z.string().min(1),
                    email_verified: z.boolean().optional(),
                  })
                  .safeParse(await response.json());
                if (!parsed.success) return null;
                return {
                  id: parsed.data.sub,
                  ...parsed.data,
                  emailVerified: parsed.data.email_verified ?? false,
                };
              } catch {
                // Provider transport/JSON failures use the normal retryable OAuth error redirect.
                return null;
              }
            },
            mapProfileToUser: (profile) => ({
              name: profile.name,
              email: profile.email,
              emailVerified: Boolean(profile.email_verified),
            }),
          },
        ],
      }),
    ],
    advanced: { cookiePrefix: 'szarans-assistant', database: { generateId: 'serial' } },
    user: { modelName: 'users' },
    session: {
      modelName: 'sessions',
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    // Match central identities by immutable provider subject, not an email link.
    account: { modelName: 'accounts', accountLinking: { enabled: false } },
    verification: { modelName: 'verifications' },
  });
}
export type AppAuth = ReturnType<typeof createAuth>;
