import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { UserAccount, UserRole, UserWorkspaceRecord, DocuStackAppProfile, UltrstIdentity, UserStorageConnection } from './types';
import { getVaultAbsolutePath, ensureWorkspaceExists, setActiveVaultConfig } from './workspaceFS';
import {
  formatCanonicalWorkspaceFolderName,
  formatCanonicalWorkspacePath,
  extractCanonicalFolderPrefix,
} from './workspace-canonical';

export { formatCanonicalWorkspaceFolderName, formatCanonicalWorkspacePath, extractCanonicalFolderPrefix };

export interface CanonicalAccount {
  id: string;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export function getDefaultUserWorkspaces(): UserWorkspaceRecord[] {
  return [];
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'docustack_salt_2026_v2').digest('hex');
}

/**
 * Validates standard email address format using RFC 5322 regex
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Dynamic resolution of cluster persister functions to avoid circular import issues
 */
async function getClusterPersister() {
  const mod = await import('./control-plane');
  return {
    fetchUsersFromCluster: mod.fetchUsersFromCluster,
    persistUserToCluster: mod.persistUserToCluster,
    deleteUserFromCluster: mod.deleteUserFromCluster,
  };
}

/**
 * Safely parse Admin credentials from any standard environment variable key,
 * handling trailing spaces, whitespace, and surrounding quotes.
 */
export function getEnvAdminCredentials(): { email: string; password: string } {
  const rawEmail =
    process.env.ADMIN_EMAIL ||
    process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
    process.env.admin_email ||
    process.env.ADMIN_USER ||
    process.env.ADMIN_USERNAME ||
    process.env.ADMIN_LOGIN ||
    '';

  const rawPassword =
    process.env.ADMIN_PASSWORD ||
    process.env.NEXT_PUBLIC_ADMIN_PASSWORD ||
    process.env.admin_password ||
    process.env.ADMIN_PASS ||
    process.env.ADMIN_PWD ||
    '';

  const cleanEmail = rawEmail.trim().replace(/^["']|["']$/g, '').toLowerCase();
  const cleanPassword = rawPassword.trim().replace(/^["']|["']$/g, '');

  return { email: cleanEmail, password: cleanPassword };
}

export function getControlPlaneDir(): string {
  try {
    const baseVaultDir = path.join(process.cwd(), 'docustack_vault');
    const metaDir = path.join(baseVaultDir, '.docustack', 'control_plane');
    if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
    return metaDir;
  } catch {
    return '/tmp';
  }
}

function getUsersFilePath(): string {
  try {
    const metaDir = getControlPlaneDir();
    const primaryPath = path.join(metaDir, 'accounts.json');
    if (!fs.existsSync(primaryPath) && fs.existsSync('/tmp/accounts.json')) {
      return '/tmp/accounts.json';
    }
    return primaryPath;
  } catch {
    return '/tmp/accounts.json';
  }
}

function getRevocationFilePath(): string {
  try {
    const metaDir = getControlPlaneDir();
    return path.join(metaDir, 'revoked_sessions.json');
  } catch {
    return '/tmp/revoked_sessions.json';
  }
}

export const APP_ID = 'docustack';

/**
 * Normalizes a user record to ensure it contains universal Ultrst identity fields
 * and synchronizes appProfiles['docustack'] with direct workspace accessors.
 */
export function normalizeUserAccount(rawUser: any): UserAccount {
  const now = new Date().toISOString();
  const appProfiles: Record<string, Record<string, any>> = rawUser.appProfiles ? { ...rawUser.appProfiles } : {};

  // Extract or initialize DocuStack profile
  const existingDocuStackProfile = appProfiles[APP_ID] || {};

  // Prioritize rawUser.workspaces if provided (direct updates happen on user.workspaces),
  // otherwise fallback to existingDocuStackProfile.workspaces
  const userWorkspaces: UserWorkspaceRecord[] =
    Array.isArray(rawUser.workspaces) && rawUser.workspaces.length > 0
      ? rawUser.workspaces
      : (Array.isArray(existingDocuStackProfile.workspaces) && existingDocuStackProfile.workspaces.length > 0
          ? existingDocuStackProfile.workspaces
          : (rawUser.workspaces || existingDocuStackProfile.workspaces || []));

  const activeWsId: string =
    rawUser.activeWorkspaceId !== undefined
      ? rawUser.activeWorkspaceId
      : (existingDocuStackProfile.activeWorkspaceId || userWorkspaces[0]?.id || '');

  const activeWs = userWorkspaces.find((w) => w.id === activeWsId) || userWorkspaces[0];
  const wsPath: string =
    rawUser.workspacePath !== undefined
      ? rawUser.workspacePath
      : (existingDocuStackProfile.workspacePath || activeWs?.workspacePath || '');
  const wsName: string =
    rawUser.workspaceName !== undefined
      ? rawUser.workspaceName
      : (existingDocuStackProfile.workspaceName || activeWs?.name || '');

  // Preserve user-saved storage connections (Backblaze B2, R2, S3, Supabase, Local)
  const directConns = Array.isArray((rawUser as any).storage_connections) ? (rawUser as any).storage_connections : [];
  const profileConns = Array.isArray(existingDocuStackProfile.storage_connections) ? existingDocuStackProfile.storage_connections : [];
  let rawConns: UserStorageConnection[];
  if (directConns.length > 0) {
    rawConns = directConns;
  } else if (profileConns.length > 0) {
    rawConns = profileConns;
  } else if (Array.isArray((rawUser as any).storage_connections)) {
    rawConns = (rawUser as any).storage_connections;
  } else if (Array.isArray(existingDocuStackProfile.storage_connections)) {
    rawConns = existingDocuStackProfile.storage_connections;
  } else {
    rawConns = [];
  }

  let storageConnections = rawConns;
  if (rawConns.length > 0 && !rawConns.some((c) => c.role === 'primary')) {
    const cloudIdx = rawConns.findIndex((c) => c.provider !== 'local_fs');
    const targetIdx = cloudIdx >= 0 ? cloudIdx : 0;
    storageConnections = rawConns.map((c, idx) => ({
      ...c,
      role: idx === targetIdx ? 'primary' : (c.role || 'redundant_clone'),
    }));
  }

  const docustackProfile: DocuStackAppProfile = {
    ...existingDocuStackProfile,
    workspacePath: wsPath,
    workspaceName: wsName,
    activeWorkspaceId: activeWsId,
    workspaces: userWorkspaces,
    storage_connections: storageConnections,
    themePreference: existingDocuStackProfile.themePreference || 'dark',
    registeredAt: existingDocuStackProfile.registeredAt || rawUser.createdAt || now,
    lastActiveAt: now,
  };

  appProfiles[APP_ID] = docustackProfile;

  return {
    id: rawUser.id || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: (rawUser.email || '').trim().toLowerCase(),
    username: rawUser.username || (rawUser.email ? rawUser.email.split('@')[0] : 'user'),
    name: rawUser.name || rawUser.displayName || rawUser.username || 'User',
    role: (rawUser.role as UserRole) || 'user',
    avatarGlyph: rawUser.avatarGlyph || '👤',
    createdAt: rawUser.createdAt || now,
    lastLoginAt: rawUser.lastLoginAt || undefined,
    updatedAt: rawUser.updatedAt || now,
    passwordHash: rawUser.passwordHash || rawUser.password_hash,
    emailVerified: rawUser.emailVerified ?? (rawUser.role === 'admin' ? true : false),
    emailVerifiedAt: rawUser.emailVerifiedAt || (rawUser.role === 'admin' ? now : undefined),
    trustLevel: rawUser.trustLevel || (rawUser.role === 'admin' ? 'T4_PRIVILEGED' : 'T0_UNVERIFIED'),
    status: rawUser.status || 'ACTIVE',
    abuseScore: rawUser.abuseScore || 0,
    successfulActivityCount: rawUser.successfulActivityCount || 0,
    sessions: rawUser.sessions || [],
    appProfiles,
    // Direct accessors for DocuStack convenience
    workspacePath: docustackProfile.workspacePath,
    workspaceName: docustackProfile.workspaceName,
    activeWorkspaceId: docustackProfile.activeWorkspaceId,
    workspaces: docustackProfile.workspaces,
    storage_connections: docustackProfile.storage_connections,
  };
}

/**
 * Ensures an app profile exists for a given appId on the user account.
 * If not present, creates it using the provided default profile factory without touching other apps.
 */
export function ensureAppProfile<T extends Record<string, any>>(
  user: UserAccount,
  appId: string,
  defaultProfileFactory: () => T
): { user: UserAccount; appProfile: T; wasCreated: boolean } {
  if (!user.appProfiles) {
    user.appProfiles = {};
  }
  let wasCreated = false;
  if (!user.appProfiles[appId]) {
    user.appProfiles[appId] = defaultProfileFactory();
    wasCreated = true;
  }
  return {
    user,
    appProfile: user.appProfiles[appId] as T,
    wasCreated,
  };
}

let inMemoryUsers: UserAccount[] | null = null;

export function loadUsers(): UserAccount[] {
  const envAdmin = getEnvAdminCredentials();
  const hasEnvAdmin = Boolean(envAdmin.email && envAdmin.password);
  const hashedEnvPassword = hasEnvAdmin ? hashPassword(envAdmin.password) : '';
  const filePath = getUsersFilePath();

  let rawUsers: any[] = [];

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      rawUsers = JSON.parse(raw);
    } else if (inMemoryUsers && inMemoryUsers.length > 0) {
      rawUsers = [...inMemoryUsers];
    }
  } catch {
    if (inMemoryUsers && inMemoryUsers.length > 0) {
      rawUsers = [...inMemoryUsers];
    }
  }

  let users = rawUsers.map((u) => normalizeUserAccount(u));

  // Purge any legacy demo, default placeholder, or hardcoded fallback accounts
  users = users.filter((u) => {
    const email = (u.email || '').toLowerCase().trim();
    const id = (u.id || '').toLowerCase();
    return (
      !email.endsWith('.vault') &&
      !email.startsWith('demo@') &&
      !email.startsWith('analyst@') &&
      email !== 'todadjp@gmail.com' &&
      !id.includes('demo') &&
      !id.includes('fallback') &&
      !id.includes('todadjp')
    );
  });

  // Only synchronize / bootstrap admin account if ADMIN_EMAIL & ADMIN_PASSWORD are provided via environment variables
  if (hasEnvAdmin) {
    let adminRecord = users.find((u) => u.role === 'admin' || u.email.toLowerCase() === envAdmin.email);
    if (adminRecord) {
      adminRecord.email = envAdmin.email;
      adminRecord.passwordHash = hashedEnvPassword;
      adminRecord.role = 'admin';
    } else {
      users.unshift(
        normalizeUserAccount({
          id: 'user-admin-01',
          email: envAdmin.email,
          username: envAdmin.email.split('@')[0] || 'admin',
          name: 'Vault Administrator',
          role: 'admin',
          avatarGlyph: '⚡',
          createdAt: new Date().toISOString(),
          passwordHash: hashedEnvPassword,
        })
      );
    }
  }

  inMemoryUsers = users;

  // Persist normalized accounts
  try {
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf-8');
  } catch {
    // Read-only filesystem is safely handled in memory
  }

  return users;
}

export function saveUsers(users: UserAccount[]): void {
  const normalized = users.map((u) => normalizeUserAccount(u));
  inMemoryUsers = normalized;
  try {
    const filePath = getUsersFilePath();
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
  } catch {
    // Read-only fallback handled
  }
}

export function findUserByEmail(email: string): UserAccount | undefined {
  const users = loadUsers();
  const normalized = (email || '').trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === normalized);
}

export function findUserById(id: string): UserAccount | undefined {
  const users = loadUsers();
  return users.find((u) => u.id === id);
}

export async function loadUsersAsync(): Promise<UserAccount[]> {
  try {
    const { fetchUsersFromCluster } = await getClusterPersister();
    const clusterUsers = await fetchUsersFromCluster();
    if (clusterUsers && clusterUsers.length > 0) {
      const localUsers = loadUsers();
      const userMap = new Map<string, UserAccount>();
      localUsers.forEach((u) => userMap.set(u.id, u));
      
      clusterUsers.forEach((u) => {
        const local = userMap.get(u.id);
        if (!local) {
          userMap.set(u.id, u);
        } else {
          // Rehydrate local storage connections if local has them and cluster snapshot hasn't synced yet
          const localConns = local.appProfiles?.docustack?.storage_connections || local.storage_connections || [];
          const clusterConns = u.appProfiles?.docustack?.storage_connections || u.storage_connections || [];
          const mergedConns = [...clusterConns];
          for (const lc of localConns) {
            const existingIdx = mergedConns.findIndex((c: any) => c.id === lc.id);
            if (existingIdx === -1) {
              mergedConns.push(lc);
            } else {
              const cl = mergedConns[existingIdx];
              mergedConns[existingIdx] = {
                ...cl,
                ...lc,
                b2ApplicationKey: (!lc.b2ApplicationKey || lc.b2ApplicationKey.includes('•')) ? cl.b2ApplicationKey : lc.b2ApplicationKey,
                r2SecretAccessKey: (!lc.r2SecretAccessKey || lc.r2SecretAccessKey.includes('•')) ? cl.r2SecretAccessKey : lc.r2SecretAccessKey,
                s3SecretAccessKey: (!lc.s3SecretAccessKey || lc.s3SecretAccessKey.includes('•')) ? cl.s3SecretAccessKey : lc.s3SecretAccessKey,
                supabaseServiceKey: (!lc.supabaseServiceKey || lc.supabaseServiceKey.includes('•')) ? cl.supabaseServiceKey : lc.supabaseServiceKey,
              };
            }
          }

          const mergedProfile = {
            ...(local.appProfiles?.docustack || {}),
            ...(u.appProfiles?.docustack || {}),
            storage_connections: mergedConns,
          };
          const mergedUser = {
            ...local,
            ...u,
            appProfiles: {
              ...(local.appProfiles || {}),
              ...(u.appProfiles || {}),
              docustack: mergedProfile,
            },
            storage_connections: mergedConns,
          };
          userMap.set(u.id, mergedUser);
        }
      });

      const merged = Array.from(userMap.values()).map((u) => normalizeUserAccount(u));
      saveUsers(merged);
      return merged;
    }
  } catch (err: any) {
    console.warn('[DocuStack AuthStorage] loadUsersAsync fallback to local:', err.message);
  }
  return loadUsers();
}

export async function findUserByEmailAsync(email: string): Promise<UserAccount | undefined> {
  const normalized = (email || '').trim().toLowerCase();
  // Always query fresh canonical cluster database first to prevent stale cache returns
  const freshUsers = await loadUsersAsync();
  const matched = freshUsers.find((u) => u.email.toLowerCase() === normalized);
  if (matched) return matched;
  return findUserByEmail(normalized);
}

export async function findUserByIdAsync(id: string): Promise<UserAccount | undefined> {
  // Always query fresh canonical cluster database first to prevent stale cache returns
  const freshUsers = await loadUsersAsync();
  const matched = freshUsers.find((u) => u.id === id);
  if (matched) return matched;
  return findUserById(id);
}

/**
 * Server-Side Admin Bootstrap Helper
 */
export function createAdminAccountServerSide(
  email: string,
  password: string,
  name?: string
): Omit<UserAccount, 'passwordHash'> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!isValidEmail(normalizedEmail) || password.length < 6) {
    throw new Error('BOOTSTRAP_ERROR: Valid email and strong password (min 6 chars) required.');
  }

  const users = loadUsers();
  const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  const now = new Date().toISOString();

  if (existing) {
    existing.role = 'admin';
    existing.passwordHash = hashPassword(password);
    if (!existing.workspaceName) existing.workspaceName = 'DocuStack Vault';
    saveUsers(users);
    getClusterPersister().then(({ persistUserToCluster }) => persistUserToCluster(existing)).catch(() => {});
    const { passwordHash: _, ...safeUser } = existing;
    return safeUser;
  }

  const newAdmin: UserAccount = {
    id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email: normalizedEmail,
    username: normalizedEmail.split('@')[0],
    name: name || 'Control Plane Administrator',
    role: 'admin',
    workspacePath: '',
    workspaceName: 'DocuStack Vault',
    avatarGlyph: '⚡',
    createdAt: now,
    passwordHash: hashPassword(password),
  };

  const normalized = normalizeUserAccount(newAdmin);
  users.push(normalized);
  saveUsers(users);
  getClusterPersister().then(({ persistUserToCluster }) => persistUserToCluster(normalized)).catch(() => {});
  const { passwordHash: _, ...safeUser } = normalized;
  return safeUser;
}

/**
 * Public User Registration Flow (Async with Direct Cluster Persistence & Email Validation)
 */
export async function registerUserAsync(
  email: string,
  password: string,
  name?: string,
  username?: string,
  workspacePath?: string,
  workspaceName?: string
): Promise<{ user: Omit<UserAccount, 'passwordHash'>; token: string }> {
  const normalizedEmail = (email || '').trim().toLowerCase();

  // 1. Email Format Validation
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('INVALID_EMAIL: Please enter a valid email address (e.g. user@example.com).');
  }

  if (!password || password.length < 6) {
    throw new Error('PASSWORD_TOO_SHORT: Password must be at least 6 characters long.');
  }

  // 2. Fetch fresh users from cluster to ensure uniqueness
  await loadUsersAsync();
  const users = loadUsers();

  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    throw new Error('USER_ALREADY_EXISTS: Account with this email already exists.');
  }

  const derivedUsername = (username || normalizedEmail.split('@')[0]).trim();
  const enforcedRole: UserRole = 'user';
  const userWorkspaces: UserWorkspaceRecord[] = [];

  const newUser: UserAccount = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email: normalizedEmail,
    username: derivedUsername,
    name: name?.trim() || derivedUsername.toUpperCase(),
    role: enforcedRole,
    workspacePath: workspacePath || '',
    workspaceName: workspaceName || '',
    activeWorkspaceId: '',
    workspaces: userWorkspaces,
    avatarGlyph: '🌱',
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password),
  };

  const normalized = normalizeUserAccount(newUser);

  // 3. Persist directly to Primary Database (Neon, Supabase, etc.) and active Clones
  // The system database credentials in environment variables are the sole source of truth.
  // We strictly do NOT swallow database errors or create phantom local accounts.
  const { persistUserToCluster } = await getClusterPersister();
  await persistUserToCluster(normalized);

  const token = createSessionToken(normalized.id);
  const { passwordHash: _, ...safeUser } = normalized;
  return { user: safeUser, token };
}

/**
 * Synchronous Registration with Email Validation & Background Cluster Persistence
 */
export function registerUser(
  email: string,
  password: string,
  name?: string,
  username?: string,
  workspacePath?: string,
  workspaceName?: string
): { user: Omit<UserAccount, 'passwordHash'>; token: string } {
  const normalizedEmail = (email || '').trim().toLowerCase();

  // 1. Email Format Validation
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('INVALID_EMAIL: Please enter a valid email address (e.g. user@example.com).');
  }

  if (!password || password.length < 6) {
    throw new Error('PASSWORD_TOO_SHORT: Password must be at least 6 characters long.');
  }

  const users = loadUsers();
  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    throw new Error('USER_ALREADY_EXISTS: Account with this email already exists.');
  }

  const derivedUsername = (username || normalizedEmail.split('@')[0]).trim();
  const enforcedRole: UserRole = 'user';
  const userWorkspaces: UserWorkspaceRecord[] = [];

  const newUser: UserAccount = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email: normalizedEmail,
    username: derivedUsername,
    name: name?.trim() || derivedUsername.toUpperCase(),
    role: enforcedRole,
    workspacePath: workspacePath || '',
    workspaceName: workspaceName || '',
    activeWorkspaceId: '',
    workspaces: userWorkspaces,
    avatarGlyph: '🌱',
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password),
  };

  const normalized = normalizeUserAccount(newUser);
  users.push(normalized);
  saveUsers(users);

  // Background persist to cluster
  getClusterPersister()
    .then(({ persistUserToCluster }) => persistUserToCluster(normalized))
    .catch((e) => console.warn('Background persist error:', e.message));

  const token = createSessionToken(normalized.id);
  const { passwordHash: _, ...safeUser } = normalized;
  return { user: safeUser, token };
}

/**
 * Robust Async User Authentication with Cluster Hydration & Fallbacks
 */
export async function authenticateUserAsync(
  email: string,
  password: string
): Promise<{ user: Omit<UserAccount, 'passwordHash'>; token: string }> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();
  const envAdmin = getEnvAdminCredentials();

  const hasEnvAdmin = Boolean(envAdmin.email && envAdmin.password);

  // 1. Check if matches environment variable admin credentials
  const isEnvAdminMatch =
    hasEnvAdmin &&
    (normalizedEmail === envAdmin.email || (envAdmin.email && normalizedEmail === 'admin')) &&
    (cleanPassword === envAdmin.password || password === envAdmin.password);

  if (isEnvAdminMatch) {
    // 1. Hydrate existing admin user from canonical cluster database first to preserve storage_connections
    let adminUser = await findUserByEmailAsync(envAdmin.email);
    if (!adminUser) {
      adminUser = findUserByEmail(envAdmin.email);
    }

    if (!adminUser) {
      const authResult = authenticateUser(email, password);
      try {
        const { persistUserToCluster } = await getClusterPersister();
        const fullUser = findUserById(authResult.user.id);
        if (fullUser) await persistUserToCluster(fullUser);
      } catch {}
      return authResult;
    }

    // Preserve all existing storage_connections, workspaces, and appProfiles
    adminUser.role = 'admin';
    adminUser.lastLoginAt = new Date().toISOString();
    adminUser.passwordHash = hashPassword(cleanPassword);

    try {
      const { persistUserToCluster } = await getClusterPersister();
      await persistUserToCluster(adminUser);
    } catch (err: any) {
      console.warn('[DocuStack AuthStorage] Admin cluster sync warning:', err.message);
    }

    const localUsers = loadUsers();
    const idx = localUsers.findIndex((u) => u.id === adminUser!.id);
    if (idx >= 0) {
      localUsers[idx] = adminUser;
    } else {
      localUsers.push(adminUser);
    }
    saveUsers(localUsers);

    const token = createSessionToken(adminUser.id);
    const { passwordHash: _, ...safeAdmin } = adminUser;
    return { user: safeAdmin, token };
  }

  // 2. User Lookup: ALWAYS query canonical cluster database directly first
  let user = await findUserByEmailAsync(normalizedEmail);
  if (!user) {
    user = findUserByEmail(normalizedEmail);
  }

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const hashRaw = hashPassword(password);
  const hashClean = hashPassword(cleanPassword);

  const isPasswordValid =
    user.passwordHash === hashRaw ||
    user.passwordHash === hashClean ||
    (user.role === 'admin' && hasEnvAdmin && cleanPassword === envAdmin.password);

  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date().toISOString();
  
  // Persist updated lastLoginAt to cluster
  try {
    const { persistUserToCluster } = await getClusterPersister();
    await persistUserToCluster(user);
  } catch {
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
      saveUsers(users);
    }
  }

  const token = createSessionToken(user.id);
  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, token };
}

/**
 * Robust Synchronous User Authentication with Strict Environment Admin Enforcement
 */
export function authenticateUser(
  email: string,
  password: string
): { user: Omit<UserAccount, 'passwordHash'>; token: string } {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();
  const envAdmin = getEnvAdminCredentials();
  const hasEnvAdmin = Boolean(envAdmin.email && envAdmin.password);

  // 1. Check if matches environment variable admin credentials
  const isEnvAdminMatch =
    hasEnvAdmin &&
    (normalizedEmail === envAdmin.email || (envAdmin.email && normalizedEmail === 'admin')) &&
    (cleanPassword === envAdmin.password || password === envAdmin.password);

  if (isEnvAdminMatch) {
    const users = loadUsers();
    let targetUser = users.find((u) => u.email.toLowerCase() === envAdmin.email) ||
      users.find((u) => u.role === 'admin');

    if (!targetUser) {
      targetUser = {
        id: 'user-admin-01',
        email: envAdmin.email,
        username: envAdmin.email.split('@')[0] || 'admin',
        name: 'Vault Administrator',
        role: 'admin',
        workspacePath: '',
        workspaceName: 'DocuStack Vault',
        avatarGlyph: '⚡',
        createdAt: new Date().toISOString(),
        passwordHash: hashPassword(cleanPassword),
      };
      users.push(targetUser);
      saveUsers(users);
    } else {
      targetUser.role = 'admin';
      targetUser.lastLoginAt = new Date().toISOString();
      if (!targetUser.workspaceName) targetUser.workspaceName = 'DocuStack Vault';
      saveUsers(users);
    }

    const token = createSessionToken(targetUser.id);
    const { passwordHash: _, ...safeUser } = targetUser;
    return { user: safeUser, token };
  }

  // 2. Database User Lookup
  const user = findUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const hashRaw = hashPassword(password);
  const hashClean = hashPassword(cleanPassword);

  const isPasswordValid =
    user.passwordHash === hashRaw ||
    user.passwordHash === hashClean ||
    (user.role === 'admin' && hasEnvAdmin && cleanPassword === envAdmin.password);

  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date().toISOString();
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    users[idx] = user;
    saveUsers(users);
  }

  const token = createSessionToken(user.id);
  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, token };
}

export function createSessionToken(userId: string): string {
  const secret = process.env.AUTH_SECRET || 'docustack_vault_session_key_2026';
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const payload = JSON.stringify({ userId, sessionId, issuedAt: Date.now(), exp: Date.now() + 7 * 24 * 3600 * 1000 });
  const b64 = Buffer.from(payload).toString('base64');
  const signature = crypto.createHmac('sha256', secret).update(b64).digest('hex');
  return `${b64}.${signature}`;
}

export function verifySessionToken(token: string): { userId: string; sessionId: string } | null {
  if (!token) return null;

  // Support "sess::<userId>::<timestamp>::<random>" format
  if (token.startsWith('sess::')) {
    const parts = token.split('::');
    if (parts.length >= 3) {
      const userId = parts[1];
      const sessionId = parts[3] || parts[2];
      if (isSessionRevoked(sessionId)) return null;
      return { userId, sessionId };
    }
  }

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [b64, signature] = parts;
  const secret = process.env.AUTH_SECRET || 'docustack_vault_session_key_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(b64).digest('hex');

  if (signature !== expectedSig) return null;

  try {
    const raw = Buffer.from(b64, 'base64').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.exp && parsed.exp < Date.now()) return null;
    
    // Check session revocation
    if (isSessionRevoked(parsed.sessionId)) return null;

    return { userId: parsed.userId, sessionId: parsed.sessionId };
  } catch {
    return null;
  }
}

export function revokeSession(sessionId: string): void {
  try {
    const filePath = getRevocationFilePath();
    let revoked: string[] = [];
    if (fs.existsSync(filePath)) {
      try {
        revoked = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        revoked = [];
      }
    }
    if (!revoked.includes(sessionId)) {
      revoked.push(sessionId);
      fs.writeFileSync(filePath, JSON.stringify(revoked, null, 2), 'utf-8');
    }
  } catch {
    // Read-only fallback
  }
}

export function isSessionRevoked(sessionId: string): boolean {
  try {
    const filePath = getRevocationFilePath();
    if (!fs.existsSync(filePath)) return false;
    const revoked: string[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return revoked.includes(sessionId);
  } catch {
    return false;
  }
}

/**
 * Server-Side Session Verification Guard
 */
export async function verifySession(req: NextRequest): Promise<{ userId: string; role: UserRole } | null> {
  const cookieToken = req.cookies.get('docustack_session')?.value;
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  const headerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;

  const token = cookieToken || headerToken;
  if (!token) return null;

  const sessionData = verifySessionToken(token);
  if (!sessionData) return null;

  let user = findUserById(sessionData.userId);
  if (!user) {
    user = await findUserByIdAsync(sessionData.userId);
  }
  if (!user) return null;

  return { userId: user.id, role: user.role };
}

export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set('docustack_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 3600,
  });
  return response;
}

export function attachAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken?: string }
): NextResponse {
  // 1. Access Token Cookie (short-lived / session)
  response.cookies.set('docustack_session', tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60, // 15 minutes
  });

  // 2. Refresh Token Cookie (HttpOnly + Secure + SameSite=lax)
  if (tokens.refreshToken) {
    response.cookies.set('docustack_refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600, // 30 days
    });
  }

  return response;
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set('docustack_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set('docustack_refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export interface RequestContextVault {
  user: UserAccount | null;
  activeWs: UserWorkspaceRecord | null;
  storageConn: UserStorageConnection | null;
  folderPrefix: string | null;
  vaultPath: string;
  vaultName: string;
}

/**
 * Server-Side Context Resolver: Resolves active workspace and storage connection per request.
 * Automatically initializes setActiveVaultConfig so serverless lambdas can write to Cloud Storage.
 */
export async function resolveRequestContextVault(req: NextRequest): Promise<RequestContextVault> {
  const cookieToken = req.cookies.get('docustack_session')?.value;
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  const headerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
  const token = cookieToken || headerToken;

  let user: UserAccount | null = null;
  if (token) {
    const sessionData = verifySessionToken(token);
    if (sessionData) {
      user = (await findUserByIdAsync(sessionData.userId)) || findUserById(sessionData.userId) || null;
    }
  }

  const requestedWsId = req.headers.get('x-workspace-id');
  const requestedWsPath = req.headers.get('x-workspace-path');

  let activeWs: UserWorkspaceRecord | null = null;
  let storageConn: UserStorageConnection | null = null;
  let folderPrefix: string | null = null;
  let vaultPath = '';
  let vaultName = 'DocuStack Vault';

  if (user) {
    const userWorkspaces: UserWorkspaceRecord[] =
      (user.workspaces && user.workspaces.length > 0 ? user.workspaces : user.appProfiles?.[APP_ID]?.workspaces) || [];

    if (requestedWsId && requestedWsId !== 'ws-main') {
      activeWs = userWorkspaces.find((w) => w.id === requestedWsId) || null;
    }
    if (!activeWs && requestedWsPath) {
      const cleanReq = requestedWsPath.replace(/^\.\//, '').trim();
      activeWs =
        userWorkspaces.find(
          (w) =>
            w.workspacePath === requestedWsPath ||
            w.workspacePath.replace(/^\.\//, '').trim() === cleanReq
        ) || null;
    }
    if (!activeWs) {
      const activeId = user.activeWorkspaceId || user.appProfiles?.[APP_ID]?.activeWorkspaceId;
      activeWs = (activeId ? userWorkspaces.find((w) => w.id === activeId) : null) || userWorkspaces[0] || null;
    }

    const profileConns = user.appProfiles?.[APP_ID]?.storage_connections;
    const directConns = user.storage_connections;
    const userConns: UserStorageConnection[] =
      Array.isArray(directConns) && directConns.length > 0
        ? directConns
        : Array.isArray(profileConns) && profileConns.length > 0
        ? profileConns
        : directConns || profileConns || [];

    const primaryConn =
      userConns.find((c) => c.role === 'primary' || (c as any).isPrimary) ||
      userConns.find((c) => c.provider !== 'local_fs') ||
      userConns[0] ||
      null;

    if (activeWs) {
      vaultPath = activeWs.workspacePath || '';
      vaultName = activeWs.name || vaultName;
      if (activeWs.storageConnectionId) {
        const wsConnId = activeWs.storageConnectionId;
        storageConn = userConns.find((c) => c.id === wsConnId) || null;
      }
      if (!storageConn) {
        storageConn = primaryConn;
      }
      if (primaryConn && (primaryConn.role === 'primary' || (primaryConn as any).isPrimary)) {
        if (!storageConn || storageConn.provider === 'local_fs') {
          storageConn = primaryConn;
        }
      }
    } else if (requestedWsPath && userConns.length > 0) {
      vaultPath = requestedWsPath;
      storageConn = primaryConn;
    } else if (userConns.length > 0) {
      storageConn = primaryConn;
    }
  }

  folderPrefix = extractCanonicalFolderPrefix(
    vaultPath,
    user?.username || user?.name || 'user',
    activeWs?.name || vaultName || 'workspace'
  );

  if (storageConn && storageConn.provider !== 'local_fs') {
    vaultPath = `./${folderPrefix}`;
  }

  setActiveVaultConfig(vaultPath, vaultName, storageConn, folderPrefix);
  if (!storageConn || storageConn.provider === 'local_fs') {
    ensureWorkspaceExists(vaultPath);
  }

  return {
    user,
    activeWs,
    storageConn,
    folderPrefix,
    vaultPath: storageConn && storageConn.provider !== 'local_fs' ? folderPrefix : getVaultAbsolutePath(vaultPath),
    vaultName,
  };
}

/**
 * Update user account details (workspaces, workspace path, workspace name, name, etc.)
 * Also accepts appProfiles to store user-scoped app data (e.g. Google Drive credentials).
 */
export function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserAccount, 'name' | 'username' | 'avatarGlyph' | 'workspacePath' | 'workspaceName' | 'role' | 'workspaces' | 'activeWorkspaceId' | 'appProfiles'>>
): UserAccount {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    throw new Error('USER_NOT_FOUND');
  }

  const updated: UserAccount = {
    ...users[idx],
    ...updates,
  };

  if (updates.activeWorkspaceId && updated.workspaces) {
    const ws = updated.workspaces.find((w) => w.id === updates.activeWorkspaceId);
    if (ws) {
      updated.workspacePath = ws.workspacePath;
      updated.workspaceName = ws.name;
    }
  }

  users[idx] = updated;
  saveUsers(users);
  return updated;
}

export async function updateUserProfileAsync(
  userId: string,
  updates: Partial<Pick<UserAccount, 'name' | 'username' | 'avatarGlyph' | 'workspacePath' | 'workspaceName' | 'role' | 'workspaces' | 'activeWorkspaceId' | 'appProfiles'>> & { storage_connections?: UserStorageConnection[] }
): Promise<UserAccount> {
  // 1. Fetch fresh user directly from canonical cluster database
  let user = await findUserByIdAsync(userId);
  if (!user) {
    user = findUserById(userId);
  }
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const existingProfile = user.appProfiles?.[APP_ID] || {};
  const newProfileUpdates = updates.appProfiles?.[APP_ID] || {};

  const mergedStorageConnections =
    updates.storage_connections !== undefined
      ? updates.storage_connections
      : (newProfileUpdates.storage_connections !== undefined
          ? newProfileUpdates.storage_connections
          : (existingProfile.storage_connections || user.storage_connections || []));

  const updatedDocuStackProfile: any = {
    ...existingProfile,
    ...newProfileUpdates,
    storage_connections: mergedStorageConnections,
    lastActiveAt: new Date().toISOString(),
  };

  if (updates.workspaces !== undefined) {
    updatedDocuStackProfile.workspaces = updates.workspaces;
  }
  if (updates.workspacePath !== undefined) {
    updatedDocuStackProfile.workspacePath = updates.workspacePath;
  }
  if (updates.workspaceName !== undefined) {
    updatedDocuStackProfile.workspaceName = updates.workspaceName;
  }
  if (updates.activeWorkspaceId !== undefined) {
    updatedDocuStackProfile.activeWorkspaceId = updates.activeWorkspaceId;
  }

  const updatedAppProfiles = {
    ...(user.appProfiles || {}),
    ...(updates.appProfiles || {}),
    [APP_ID]: updatedDocuStackProfile,
  };

  const updated: UserAccount = normalizeUserAccount({
    ...user,
    ...updates,
    appProfiles: updatedAppProfiles,
    storage_connections: mergedStorageConnections,
    updatedAt: new Date().toISOString(),
  });

  if (updates.activeWorkspaceId && updated.workspaces) {
    const ws = updated.workspaces.find((w) => w.id === updates.activeWorkspaceId);
    if (ws) {
      updated.workspacePath = ws.workspacePath;
      updated.workspaceName = ws.name;
    }
  }

  // 2. Update local cache immediately so state is never lost
  const localUsers = loadUsers();
  const idx = localUsers.findIndex((u) => u.id === userId);
  if (idx >= 0) {
    localUsers[idx] = updated;
  } else {
    localUsers.push(updated);
  }
  saveUsers(localUsers);

  // 3. Persist to canonical cluster databases (Neon, Supabase, Postgres)
  try {
    const { persistUserToCluster } = await getClusterPersister();
    await persistUserToCluster(updated);
  } catch (err: any) {
    console.warn('[DocuStack AuthStorage] updateUserProfileAsync cluster sync warning:', err.message);
  }

  return updated;
}

/**
 * Workspace management operations directly on the user object in the core database
 */
export function getUserWorkspaces(userId: string): UserWorkspaceRecord[] {
  const user = findUserById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  return user.workspaces || [];
}

export async function getUserWorkspacesAsync(userId: string): Promise<UserWorkspaceRecord[]> {
  const user = await findUserByIdAsync(userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  return user.workspaces || [];
}

export function addUserWorkspace(
  userId: string,
  wsData: Omit<UserWorkspaceRecord, 'id' | 'createdAt' | 'updatedAt'>
): UserWorkspaceRecord {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('USER_NOT_FOUND');

  const user = users[idx];
  const userName = user.username || user.name || (user.email ? user.email.split('@')[0] : 'user');
  const canonicalPath = formatCanonicalWorkspacePath(APP_ID, userName, wsData.name);

  const now = new Date().toISOString();
  const newWorkspace: UserWorkspaceRecord = {
    ...wsData,
    workspacePath: canonicalPath,
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    updatedAt: now,
  };

  const workspaces = [...(user.workspaces || []), newWorkspace];
  
  user.workspaces = workspaces;
  user.activeWorkspaceId = newWorkspace.id;
  user.workspacePath = newWorkspace.workspacePath;
  user.workspaceName = newWorkspace.name;

  if (user.appProfiles && user.appProfiles[APP_ID]) {
    user.appProfiles[APP_ID].workspaces = workspaces;
    user.appProfiles[APP_ID].activeWorkspaceId = newWorkspace.id;
    user.appProfiles[APP_ID].workspacePath = newWorkspace.workspacePath;
    user.appProfiles[APP_ID].workspaceName = newWorkspace.name;
  }

  users[idx] = user;
  saveUsers(users);
  return newWorkspace;
}

export async function addUserWorkspaceAsync(
  userId: string,
  wsData: Omit<UserWorkspaceRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<UserWorkspaceRecord> {
  const newWs = addUserWorkspace(userId, wsData);
  const user = findUserById(userId);
  if (user) {
    try {
      const { persistUserToCluster } = await getClusterPersister();
      await persistUserToCluster(user);
    } catch (err: any) {
      console.warn('[DocuStack AuthStorage] addUserWorkspaceAsync cluster sync error:', err.message);
    }
  }
  return newWs;
}

export function updateUserWorkspace(
  userId: string,
  workspaceId: string,
  updates: Partial<UserWorkspaceRecord>
): UserWorkspaceRecord {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('USER_NOT_FOUND');

  const user = users[idx];
  const workspaces = user.workspaces || [];
  const wsIdx = workspaces.findIndex((w) => w.id === workspaceId);
  if (wsIdx === -1) throw new Error('WORKSPACE_NOT_FOUND');

  const now = new Date().toISOString();
  const targetName = updates.name !== undefined ? updates.name : workspaces[wsIdx].name;
  const userName = user.username || user.name || (user.email ? user.email.split('@')[0] : 'user');
  const canonicalPath = formatCanonicalWorkspacePath(APP_ID, userName, targetName);

  const updatedWs: UserWorkspaceRecord = {
    ...workspaces[wsIdx],
    ...updates,
    workspacePath: canonicalPath,
    updatedAt: now,
  };

  workspaces[wsIdx] = updatedWs;
  user.workspaces = workspaces;

  if (user.appProfiles && user.appProfiles[APP_ID]) {
    user.appProfiles[APP_ID].workspaces = workspaces;
  }

  if (user.activeWorkspaceId === workspaceId) {
    user.workspacePath = updatedWs.workspacePath;
    user.workspaceName = updatedWs.name;
    if (user.appProfiles && user.appProfiles[APP_ID]) {
      user.appProfiles[APP_ID].workspacePath = updatedWs.workspacePath;
      user.appProfiles[APP_ID].workspaceName = updatedWs.name;
    }
  }

  users[idx] = user;
  saveUsers(users);
  return updatedWs;
}

export async function updateUserWorkspaceAsync(
  userId: string,
  workspaceId: string,
  updates: Partial<UserWorkspaceRecord>
): Promise<UserWorkspaceRecord> {
  const updatedWs = updateUserWorkspace(userId, workspaceId, updates);
  const user = findUserById(userId);
  if (user) {
    try {
      const { persistUserToCluster } = await getClusterPersister();
      await persistUserToCluster(user);
    } catch (err: any) {
      console.warn('[DocuStack AuthStorage] updateUserWorkspaceAsync cluster sync error:', err.message);
    }
  }
  return updatedWs;
}

export function deleteUserWorkspace(userId: string, workspaceId: string): void {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('USER_NOT_FOUND');

  const user = users[idx];
  const workspaces = (user.workspaces || []).filter((w) => w.id !== workspaceId);

  user.workspaces = workspaces;
  if (user.appProfiles && user.appProfiles[APP_ID]) {
    user.appProfiles[APP_ID].workspaces = workspaces;
  }

  if (user.activeWorkspaceId === workspaceId) {
    if (workspaces.length > 0) {
      user.activeWorkspaceId = workspaces[0].id;
      user.workspacePath = workspaces[0].workspacePath;
      user.workspaceName = workspaces[0].name;
    } else {
      user.activeWorkspaceId = '';
      user.workspacePath = '';
      user.workspaceName = '';
    }
    if (user.appProfiles && user.appProfiles[APP_ID]) {
      user.appProfiles[APP_ID].activeWorkspaceId = user.activeWorkspaceId;
      user.appProfiles[APP_ID].workspacePath = user.workspacePath;
      user.appProfiles[APP_ID].workspaceName = user.workspaceName;
    }
  }

  users[idx] = normalizeUserAccount(user);
  saveUsers(users);
}

export async function deleteUserWorkspaceAsync(userId: string, workspaceId: string): Promise<void> {
  deleteUserWorkspace(userId, workspaceId);
  const user = findUserById(userId);
  if (user) {
    try {
      const { persistUserToCluster } = await getClusterPersister();
      await persistUserToCluster(user);
    } catch (err: any) {
      console.warn('[DocuStack AuthStorage] deleteUserWorkspaceAsync cluster sync error:', err.message);
    }
  }
}

export function switchActiveWorkspace(userId: string, workspaceId: string): UserWorkspaceRecord {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('USER_NOT_FOUND');

  const user = users[idx];
  const workspaces = user.workspaces || [];
  const targetWs = workspaces.find((w) => w.id === workspaceId);
  if (!targetWs) throw new Error('WORKSPACE_NOT_FOUND');

  user.activeWorkspaceId = targetWs.id;
  user.workspacePath = targetWs.workspacePath;
  user.workspaceName = targetWs.name;

  if (user.appProfiles && user.appProfiles[APP_ID]) {
    user.appProfiles[APP_ID].activeWorkspaceId = targetWs.id;
    user.appProfiles[APP_ID].workspacePath = targetWs.workspacePath;
    user.appProfiles[APP_ID].workspaceName = targetWs.name;
  }

  users[idx] = user;
  saveUsers(users);
  return targetWs;
}

export async function switchActiveWorkspaceAsync(userId: string, workspaceId: string): Promise<UserWorkspaceRecord> {
  const activeWs = switchActiveWorkspace(userId, workspaceId);
  const user = findUserById(userId);
  if (user) {
    try {
      const { persistUserToCluster } = await getClusterPersister();
      await persistUserToCluster(user);
    } catch (err: any) {
      console.warn('[DocuStack AuthStorage] switchActiveWorkspaceAsync cluster sync error:', err.message);
    }
  }
  return activeWs;
}

