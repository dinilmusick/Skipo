/**
 * @file authCore.ts
 * @description Universal Authentication Core Service for MyApp.
 * Governs user login, registration, and user listing via unifiedDb.
 * Runs identically in Node.js, Vercel Serverless, and Cloudflare Workers (< 200 lines).
 */

import bcrypt from 'bcryptjs';
import { queryUnifiedDb } from './unifiedDb';

export async function loginUser(
  email?: string,
  password?: string,
  isAdmin: boolean = false,
  env?: Record<string, unknown>
) {
  const normEmail = (email || '').trim().toLowerCase();
  const rawPassword = (password || '').trim();

  if (!normEmail || !rawPassword) {
    return { success: false, error: 'Email and password are required', status: 400 };
  }

  try {
    if (isAdmin) {
      const credRes = await queryUnifiedDb(
        `SELECT * FROM "ultrst-credentials" WHERE id = 'system' LIMIT 1`,
        [],
        env
      );
      if (credRes.rows.length > 0) {
        const cred = credRes.rows[0];
        const emailMatch = (cred.admin_email || '').toLowerCase() === normEmail;
        const passMatch =
          cred.admin_password === rawPassword ||
          (cred.admin_password && bcrypt.compareSync(rawPassword, cred.admin_password));
        if (emailMatch && passMatch) {
          return {
            success: true,
            status: 200,
            token: `adm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            user: { id: 'admin_sys', email: cred.admin_email, role: 'admin', username: 'System Admin' },
          };
        }
      }
    }

    const uRes = await queryUnifiedDb(
      `SELECT * FROM "ultrst-users" WHERE LOWER(email) = $1 LIMIT 1`,
      [normEmail],
      env
    );
    if (uRes.rows.length === 0) {
      return { success: false, error: 'Invalid email or password', status: 401 };
    }

    const user = uRes.rows[0];
    const hash = user.password_hash || '';
    let isMatch = false;

    if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      isMatch = bcrypt.compareSync(rawPassword, hash);
    } else {
      isMatch = hash === rawPassword;
    }

    if (!isMatch) {
      return { success: false, error: 'Invalid email or password', status: 401 };
    }

    if (isAdmin && user.role !== 'admin') {
      return { success: false, error: 'Insufficient administrative privileges', status: 403 };
    }

    return {
      success: true,
      status: 200,
      token: `usr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      user: {
        id: user.id,
        email: user.email,
        username: user.username || user.name || user.email.split('@')[0],
        name: user.name || user.username || 'Ecosystem User',
        role: user.role || 'user',
        status: user.status || 'ACTIVE',
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message, status: 500 };
  }
}

export async function registerUser(
  data: { name: string; email: string; password: string; role?: string },
  env?: Record<string, unknown>
) {
  const normEmail = (data.email || '').trim().toLowerCase();
  const rawPassword = (data.password || '').trim();

  if (!normEmail || !rawPassword) {
    return { success: false, error: 'Email and password are required', status: 400 };
  }

  try {
    const existing = await queryUnifiedDb(
      `SELECT id FROM "ultrst-users" WHERE LOWER(email) = $1 LIMIT 1`,
      [normEmail],
      env
    );
    if (existing.rows.length > 0) {
      return { success: false, error: 'An account with this email already exists', status: 409 };
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(rawPassword, salt);
    const role = data.role || 'user';
    const username = normEmail.split('@')[0];

    await queryUnifiedDb(
      `INSERT INTO "ultrst-users" (id, email, username, name, role, password_hash, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())`,
      [userId, normEmail, username, data.name || username, role, hash],
      env
    );

    return {
      success: true,
      status: 201,
      token: `usr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      user: { id: userId, email: normEmail, username, name: data.name || username, role, status: 'ACTIVE' },
    };
  } catch (err: any) {
    return { success: false, error: err.message, status: 500 };
  }
}

export async function getUsers(env?: Record<string, unknown>) {
  try {
    const res = await queryUnifiedDb(
      `SELECT id, email, username, name, role, status, created_at, last_login_at FROM "ultrst-users" ORDER BY created_at ASC`,
      [],
      env
    );
    return { success: true, count: res.rows.length, users: res.rows };
  } catch (err: any) {
    return { success: false, error: err.message, count: 0, users: [] };
  }
}
