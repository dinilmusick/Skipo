// src/auth/PasswordHasher.ts
var bcrypt = null;
try {
  bcrypt = (await import("bcryptjs")).default;
} catch (e) {
  console.warn("[Skipo] bcryptjs not installed. Using fallback hashing (DEV ONLY).");
}
var PasswordHasher = class {
  static async hash(password, saltRounds = 10) {
    if (bcrypt) {
      return bcrypt.hash(password, saltRounds);
    }
    return `fallback_hash_${Buffer.from(password).toString("base64")}`;
  }
  static async verify(password, hash) {
    if (bcrypt) {
      return bcrypt.compare(password, hash);
    }
    return hash === `fallback_hash_${Buffer.from(password).toString("base64")}`;
  }
};

// src/auth/SessionManager.ts
var SessionManager = class {
  ttl;
  constructor(ttlMs = 864e5) {
    this.ttl = ttlMs;
  }
  generateToken(userId) {
    return `sess::${userId}::${Date.now()}::${Math.random().toString(36).substring(2, 9)}`;
  }
  createSession(userId, role) {
    return {
      token: this.generateToken(userId),
      userId,
      role,
      expiresAt: Date.now() + this.ttl
    };
  }
  isValid(session) {
    return Date.now() < session.expiresAt;
  }
};

// src/auth/RateLimiter.ts
var RateLimiter = class {
  attempts = /* @__PURE__ */ new Map();
  windowMs;
  maxUser;
  maxAdmin;
  constructor(windowMs = 9e5, maxUser = 5, maxAdmin = 3) {
    this.windowMs = windowMs;
    this.maxUser = maxUser;
    this.maxAdmin = maxAdmin;
  }
  check(identifier, isAdminAttempt = false) {
    const now = Date.now();
    let record = this.attempts.get(identifier);
    if (!record || now - record.windowStart > this.windowMs) {
      record = { count: 0, windowStart: now };
      this.attempts.set(identifier, record);
    }
    record.count++;
    const limit = isAdminAttempt ? this.maxAdmin : this.maxUser;
    if (record.count > limit) {
      throw new Error("Too many requests. Please try again later.");
    }
  }
  reset(identifier) {
    this.attempts.delete(identifier);
  }
};

// src/auth/BaseAccountProvider.ts
import { SkipoBase } from "@skipo/core";
var BaseAccountProvider = class extends SkipoBase {
  rateLimiter = new RateLimiter();
  sessionManager = new SessionManager();
  async authenticate(credentials) {
    this.rateLimiter.check(credentials.email);
    const user = await this.findUserByEmail(credentials.email);
    if (!user) {
      throw new Error("Invalid credentials.");
    }
    const isValid = await PasswordHasher.verify(credentials.password, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid credentials.");
    }
    this.rateLimiter.reset(credentials.email);
    return this.sessionManager.createSession(user.id, user.role);
  }
  async signup(input) {
    const existing = await this.findUserByEmail(input.email);
    if (existing) {
      throw new Error("Email already in use.");
    }
    const passwordHash = await PasswordHasher.hash(input.password);
    return this.createUser({
      email: input.email,
      passwordHash,
      role: "user",
      // Enforce user role
      displayName: input.displayName
    });
  }
  async verifySession(token) {
    if (!token) return null;
    const parts = token.split("::");
    if (parts.length >= 4 && parts[0] === "sess") {
      const userId = parts[1];
      const user = await this.findUserById(userId);
      if (user) {
        const issueTime = parseInt(parts[2], 10);
        if (Date.now() - issueTime < 864e5) {
          return {
            token,
            userId: user.id,
            role: user.role,
            expiresAt: issueTime + 864e5
          };
        }
      }
    }
    return null;
  }
};

// src/auth/LocalAccountProvider.ts
import { promises as fs } from "fs";
import path from "path";
var LocalAccountProvider = class extends BaseAccountProvider {
  filePath;
  users = /* @__PURE__ */ new Map();
  isLoaded = false;
  constructor(filePath = ".skipo/accounts.json") {
    super();
    this.filePath = path.resolve(filePath);
  }
  async load() {
    if (this.isLoaded) return;
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const data = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(data);
      for (const [id, user] of Object.entries(parsed)) {
        this.users.set(id, user);
      }
    } catch (e) {
      if (e.code !== "ENOENT") {
        throw e;
      }
    }
    this.isLoaded = true;
  }
  async persist() {
    const data = Object.fromEntries(this.users);
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }
  async findUserByEmail(email) {
    await this.load();
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }
  async findUserById(id) {
    await this.load();
    return this.users.get(id) || null;
  }
  async createUser(data) {
    await this.load();
    const isFirst = this.users.size === 0;
    const user = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: data.email,
      passwordHash: data.passwordHash,
      role: isFirst ? "admin" : data.role,
      displayName: data.displayName,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.users.set(user.id, user);
    await this.persist();
    return user;
  }
  async updateUser(id, data) {
    await this.load();
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    const updated = { ...user, ...data, updatedAt: Date.now() };
    this.users.set(id, updated);
    await this.persist();
    return updated;
  }
  async listUsers() {
    await this.load();
    return Array.from(this.users.values());
  }
};

// src/auth/AdminGuard.ts
import { SkipoBase as SkipoBase2 } from "@skipo/core";
var AdminGuard = class _AdminGuard extends SkipoBase2 {
  static async verify(authHeaderOrToken, provider) {
    const session = await _AdminGuard.verifyUser(authHeaderOrToken, provider);
    if (session.role !== "admin") {
      throw new Error("Forbidden: Admin access required.");
    }
    return session;
  }
  static async verifyUser(authHeaderOrToken, provider) {
    const token = authHeaderOrToken?.startsWith("Bearer ") ? authHeaderOrToken.substring(7).trim() : authHeaderOrToken?.trim() || null;
    const session = await provider.verifySession(token);
    if (!session) {
      throw new Error("Unauthorized: Invalid or missing session token.");
    }
    return session;
  }
};

export {
  PasswordHasher,
  SessionManager,
  RateLimiter,
  BaseAccountProvider,
  LocalAccountProvider,
  AdminGuard
};
