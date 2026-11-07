import {
  GoogleDriveStorageService,
  refreshGoogleDriveAccessToken,
} from '@ultrst-armada/kloks/backend';

export interface GoogleDriveOAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
}

export interface GoogleDriveWorkspaceConnection {
  id: string;
  provider: 'google_drive';
  googleAccessToken?: string;
  googleAccessTokenExpiresAt?: number;
  googleRefreshToken?: string;
  googleRootFolderId?: string;
}

export interface GoogleDriveWorkspaceStorageHandle {
  storage: GoogleDriveStorageService;
  connection: GoogleDriveWorkspaceConnection;
}

/** Read confidential OAuth settings only in the server runtime. */
export function getGoogleDriveOAuthConfigFromEnv(): GoogleDriveOAuthConfig {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || undefined;
  if (!clientId) {
    throw new Error('GOOGLE_DRIVE_CLIENT_ID must be configured in the server secret store.');
  }
  return { clientId, clientSecret: clientSecret || undefined, redirectUri };
}

/**
 * Create the canonical Kloks Drive adapter for an SRKL-authorized connection.
 * OAuth refresh happens here with server-owned credentials; the client secret
 * and refresh token are never copied into the adapter configuration or browser.
 */
export async function createGoogleDriveWorkspaceStorage(
  source: GoogleDriveWorkspaceConnection,
  oauth: GoogleDriveOAuthConfig = getGoogleDriveOAuthConfigFromEnv(),
): Promise<GoogleDriveWorkspaceStorageHandle> {
  if (source.provider !== 'google_drive') {
    throw new Error('A Google Drive workspace connection is required.');
  }
  if (!oauth.clientId) {
    throw new Error('Google Drive OAuth client ID is not configured.');
  }

  const connection = { ...source };
  let accessToken = connection.googleAccessToken || '';
  let expiresAt = Number(connection.googleAccessTokenExpiresAt || 0);
  const shouldRefresh = !accessToken || (expiresAt > 0 && expiresAt <= Date.now() + 60_000);

  if (shouldRefresh) {
    if (!connection.googleRefreshToken || !oauth.clientSecret) {
      throw new Error('Google Drive token refresh requires the connection refresh token and a server-owned OAuth client secret. Reconnect through SRKL or configure the secret.');
    }
    const tokenSet = await refreshGoogleDriveAccessToken(
      oauth.clientId,
      connection.googleRefreshToken,
      oauth.clientSecret,
      oauth.redirectUri,
    );
    accessToken = tokenSet.accessToken;
    expiresAt = tokenSet.expiresAt;
    connection.googleAccessToken = accessToken;
    connection.googleAccessTokenExpiresAt = expiresAt;
  }

  const storage = new GoogleDriveStorageService({
    provider: 'google_drive',
    googleClientId: oauth.clientId,
    googleRedirectUri: oauth.redirectUri,
    googleAccessToken: accessToken,
    googleAccessTokenExpiresAt: expiresAt || undefined,
    googleRootFolderId: connection.googleRootFolderId || 'root',
  });

  return { storage, connection };
}
