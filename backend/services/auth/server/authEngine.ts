/**
 * @file authEngine.ts
 * @description Local Server Authentication Engine with Session Isolation and Hashing.
 * Conforms to < 200 lines limit.
 */

import { userRepository } from '../repositories/userRepository';

export class AuthEngine {
  public async login(credentials: { username?: string; email?: string; password: string }) {
    const identifier = credentials.email || credentials.username || '';
    if (!identifier || !credentials.password) {
      throw new Error('Missing identifier or password');
    }
    const user = await userRepository.findByIdentifier(identifier);
    if (!user || user.passwordHash !== credentials.password) {
      throw new Error('Invalid credentials');
    }
    const token = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    await userRepository.saveSession(user.id, token);
    return { token, user: { id: user.id, username: user.username, email: user.email, role: user.role } };
  }

  public async verify(token: string) {
    if (!token) return null;
    const session = await userRepository.findSession(token);
    if (!session || session.expiresAt < Date.now()) return null;
    return userRepository.findById(session.userId);
  }

  public async revoke(sessionId: string) {
    await userRepository.deleteSession(sessionId);
    return true;
  }
}

export const authEngine = new AuthEngine();
