/**
 * ASCII Architecture Flowchart: SessionManager
 *
 *   ┌──────────────────────────────────────┐
 *   │      Initialize SessionManager       │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │  Execute Component / Pipeline Logic  │
 *   └──────────────────────────────────────┘
 *                      │
 *                      ▼
 *   ┌──────────────────────────────────────┐
 *   │    Return State / Result Payload     │
 *   └──────────────────────────────────────┘
 */

import { AuthSession, UserRole } from './types.js';

// ════ TYPES & DOMAIN CONTRACTS ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export class SessionManager {
  private ttl: number;

  constructor(ttlMs = 86400000) {
    this.ttl = ttlMs;
  }

  generateToken(userId: string): string {
    return `sess::${userId}::${Date.now()}::${Math.random().toString(36).substring(2, 9)}`;
  }

  createSession(userId: string, role: UserRole): AuthSession {
    return {
      token: this.generateToken(userId),
      userId,
      role,
      expiresAt: Date.now() + this.ttl
    };
  }

  isValid(session: AuthSession): boolean {
    return Date.now() < session.expiresAt;
  }
}