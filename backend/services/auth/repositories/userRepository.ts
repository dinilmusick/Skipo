/**
 * @file userRepository.ts
 * @description User & Session Persistence Boundary using Repository Pattern.
 * Conforms to APP_ARCHITECTURE_SPEC Section 20 & < 200 lines.
 */

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
}

export class UserRepository {
  private users: Map<string, UserRecord> = new Map();
  private sessions: Map<string, SessionRecord> = new Map();

  public async findByIdentifier(identifier: string): Promise<UserRecord | null> {
    for (const u of this.users.values()) {
      if (u.email === identifier || u.username === identifier) return u;
    }
    return null;
  }

  public async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) || null;
  }

  public async saveUser(user: UserRecord): Promise<void> {
    this.users.set(user.id, user);
  }

  public async saveSession(userId: string, token: string): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: `s_${Date.now()}`,
      userId,
      token,
      expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
    };
    this.sessions.set(token, session);
    return session;
  }

  public async findSession(token: string): Promise<SessionRecord | null> {
    return this.sessions.get(token) || null;
  }

  public async deleteSession(tokenOrId: string): Promise<void> {
    for (const [token, session] of this.sessions.entries()) {
      if (token === tokenOrId || session.id === tokenOrId) {
        this.sessions.delete(token);
        break;
      }
    }
  }
}

export const userRepository = new UserRepository();
