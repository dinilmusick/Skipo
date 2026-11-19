import { betterAuth } from "better-auth";
import { oauthProvider } from "@better-auth/oauth-provider";
import { jwt, bearer } from "better-auth/plugins";

/**
 * Isolated, NON-DEPLOYABLE schema-only mirror of Luth Better Auth 1.7.15.
 * No production credentials, databases, or application code are imported.
 * The official CLI --adapter drizzle --dialect postgresql generates SQL
 * for the exact provider/jwt/bearer schema without a database connection.
 */
export const auth = betterAuth({
  appName: "Luth schema rehearsal",
  baseURL: "https://schema-rehearsal.invalid",
  basePath: "/api/auth",
  secret: "schema-rehearsal-only-not-for-actual-auth-aaa",
  emailAndPassword: { enabled: true },
  plugins: [
    bearer(),
    jwt({ disableSettingJwtHeader: true }),
    oauthProvider({
      loginPage: "/",
      consentPage: "/consent",
      allowDynamicClientRegistration: false,
      allowUnauthenticatedClientRegistration: false,
      allowClientKeyRotation: false,
      clientPrivileges: async () => false,
      grantTypes: ["authorization_code", "refresh_token"],
      scopes: ["openid", "profile", "email", "offline_access"],
    }),
  ],
});
