import { SkipoBase } from '@skipo/core';

type UserRole = 'user' | 'admin';
interface User {
    id: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    displayName?: string;
    createdAt: number;
    updatedAt: number;
}
interface AuthCredentials {
    email: string;
    password: string;
}
interface AuthSession {
    token: string;
    userId: string;
    role: UserRole;
    expiresAt: number;
}
interface SignupInput {
    email: string;
    password: string;
    displayName?: string;
}
interface CreateUserData {
    email: string;
    passwordHash: string;
    role: UserRole;
    displayName?: string;
}

declare class PasswordHasher {
    static hash(password: string, saltRounds?: number): Promise<string>;
    static verify(password: string, hash: string): Promise<boolean>;
}

declare class SessionManager {
    private ttl;
    constructor(ttlMs?: number);
    generateToken(userId: string): string;
    createSession(userId: string, role: UserRole): AuthSession;
    isValid(session: AuthSession): boolean;
}

declare class RateLimiter {
    private attempts;
    private windowMs;
    private maxUser;
    private maxAdmin;
    constructor(windowMs?: number, maxUser?: number, maxAdmin?: number);
    check(identifier: string, isAdminAttempt?: boolean): void;
    reset(identifier: string): void;
}

declare abstract class BaseAccountProvider extends SkipoBase {
    protected rateLimiter: RateLimiter;
    protected sessionManager: SessionManager;
    abstract findUserByEmail(email: string): Promise<User | null>;
    abstract findUserById(id: string): Promise<User | null>;
    abstract createUser(data: CreateUserData): Promise<User>;
    abstract updateUser(id: string, data: Partial<User>): Promise<User>;
    abstract listUsers(): Promise<User[]>;
    authenticate(credentials: AuthCredentials): Promise<AuthSession>;
    signup(input: SignupInput): Promise<User>;
    verifySession(token: string | null): Promise<AuthSession | null>;
}

declare class LocalAccountProvider extends BaseAccountProvider {
    private filePath;
    private users;
    private isLoaded;
    constructor(filePath?: string);
    private load;
    private persist;
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(id: string): Promise<User | null>;
    createUser(data: CreateUserData): Promise<User>;
    updateUser(id: string, data: Partial<User>): Promise<User>;
    listUsers(): Promise<User[]>;
}

declare class AdminGuard extends SkipoBase {
    static verify(authHeaderOrToken: string | null | undefined, provider: BaseAccountProvider): Promise<AuthSession>;
    static verifyUser(authHeaderOrToken: string | null | undefined, provider: BaseAccountProvider): Promise<AuthSession>;
}

export { AdminGuard, type AuthCredentials, type AuthSession, BaseAccountProvider, type CreateUserData, LocalAccountProvider, PasswordHasher, RateLimiter, SessionManager, type SignupInput, type User, type UserRole };
