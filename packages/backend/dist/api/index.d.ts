import { SkipoBase } from '@skipo/core';

interface ApiResponse<T> {
    data?: T;
    error?: string;
    status: number;
}
interface ApiError {
    message: string;
    code?: string;
}
interface RouteConfig {
    auth?: boolean;
    admin?: boolean;
    rateLimit?: boolean;
}

declare abstract class BaseApiRoute extends SkipoBase {
    protected config: RouteConfig;
    constructor(config?: RouteConfig);
    abstract handle(req: Request): Promise<Response>;
    protected success<T>(data: T, status?: number): Response;
    protected error(message: string, status?: number): Response;
}

type Middleware = (req: Request) => Promise<Response | null>;
declare function withAuth(verifyToken: (token: string) => Promise<boolean>): Middleware;
declare function withCors(allowedOrigin?: string): Middleware;

declare function createSSEResponse(setupStream: (send: (event: string, data: any) => void) => () => void, heartbeatMs?: number): Response;

export { type ApiError, type ApiResponse, BaseApiRoute, type Middleware, type RouteConfig, createSSEResponse, withAuth, withCors };
