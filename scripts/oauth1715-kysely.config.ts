import { betterAuth } from 'better-auth';
import { oauthProvider } from '@better-auth/oauth-provider';
import { jwt, bearer } from 'better-auth/plugins';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

/**
 * Ephemeral local PostgreSQL-only schema mirror of production Luth 1.7.15.
 * Test database supplied by CI service container; never use a production URL.
 * Uses the SAME Kysely dialect and Better Auth database adapter as Luth.
 */
if (process.env.PGTEST_URL !== 'postgresql://auth_test:auth_test@127.0.0.1:5432/auth_test') {
  throw Error('REFUSING_NON_EPHEMERAL_DATABASE_FOR_SCHEMA_REHEARSAL');
}
const db = new Kysely({ dialect: new PostgresDialect({
  pool: new pg.Pool({ connectionString: process.env.PGTEST_URL }),
}) });
export const auth = betterAuth({
  appName: 'Luth',
  baseURL: 'https://schema-rehearsal.invalid',
  basePath: '/api/auth',
  secret: 'schema-rehearsal-only-never-use-in-production-aa',
  database: { db, type: 'postgres' },
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
  disabledPaths: ['/token'],
  plugins: [
    bearer(),
    jwt({ disableSettingJwtHeader: true }),
    oauthProvider({
      loginPage: '/',
      consentPage: '/consent',
      allowDynamicClientRegistration: false,
      allowUnauthenticatedClientRegistration: false,
      allowClientKeyRotation: false,
      clientPrivileges: async () => false,
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['openid', 'profile', 'email', 'offline_access'],
    }),
  ],
  account: { storeStateStrategy: 'database', skipStateCookieCheck: true },
  session: { cookieCache: { enabled: false } },
});
